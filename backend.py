import os
import uuid
import asyncio
import json
import math
import time
import signal
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path
from contextlib import asynccontextmanager
import torch
import sqlite3
import threading
from concurrent.futures import ThreadPoolExecutor
from pydantic import BaseModel, Field

# Import your existing modules
from text_similarity import EnhancedTrademarkAnalyzer
from text_extraction_groq import TextExtractor
from test_visual_similarity import VisualSimilarityAnalyzer
from journal_processor import process_trademarks, extract_data_from_pdf

# ================================
# UTILITY FUNCTIONS
# ================================

def convert_path_to_url(file_path):
    """Convert file system path to web-accessible URL"""
    if not file_path:
        return "/placeholder.png"
    
    file_path = str(file_path).replace("\\", "/")
    
    # Handle absolute paths
    if os.path.isabs(file_path):
        filename = os.path.basename(file_path)
        # Check if file exists in trademark_images or extracted_logos
        if os.path.exists(os.path.join("trademark_images", filename)):
            return f"http://localhost:8000/trademark_images/{filename}"
        elif os.path.exists(os.path.join("extracted_logos", filename)):
            return f"http://localhost:8000/extracted_logos/journal/{filename}"
        elif os.path.exists(file_path):
            # Copy file to trademark_images if it exists elsewhere
            import shutil
            os.makedirs("trademark_images", exist_ok=True)
            dest_path = os.path.join("trademark_images", filename)
            try:
                shutil.copy2(file_path, dest_path)
                return f"http://localhost:8000/trademark_images/{filename}"
            except:
                pass
    
    filename = os.path.basename(file_path)
    if "trademark_images" in file_path or filename.startswith("image_"):
        return f"http://localhost:8000/trademark_images/{filename}"
    elif "extracted_logos" in file_path:
        return f"http://localhost:8000/extracted_logos/journal/{filename}"
    else:
        return f"http://localhost:8000/trademark_images/{filename}"

# ================================
# DATABASE MODELS & SETUP
# ================================

class DatabaseManager:
    def __init__(self, db_path="trademark_api.db"):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.init_database()
        self.migrate_database()

    def get_connection(self):
        return sqlite3.connect(self.db_path)

    def init_database(self):
        """Initialize database tables"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Create analysis_sessions table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS analysis_sessions (
                id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                status TEXT DEFAULT 'pending',
                config_json TEXT,
                results_json TEXT,
                total_comparisons INTEGER DEFAULT 0,
                processed_comparisons INTEGER DEFAULT 0,
                high_risk_found INTEGER DEFAULT 0,
                medium_risk_found INTEGER DEFAULT 0,
                no_risk_found INTEGER DEFAULT 0,
                processing_time REAL DEFAULT 0,
                error_message TEXT,
                journal_name TEXT
            )
            ''')
            
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS journal_metadata (
                id TEXT PRIMARY KEY,
                journal_no TEXT,
                journal_date TEXT,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total_device_entries INTEGER DEFAULT 0,
                total_word_entries INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                pdf_filename TEXT,
                pdf_path TEXT
            )
            ''')
            
            # Create exported_reports table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS exported_reports (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                title TEXT,
                type TEXT,
                format TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                file_path TEXT,
                data_json TEXT,
                FOREIGN KEY (session_id) REFERENCES analysis_sessions (id)
            )
            ''')
            
            conn.commit()
            conn.close()
        except Exception as e:
            pass

    def migrate_database(self):
        """Migrate database schema"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Add any missing columns
            try:
                cursor.execute('ALTER TABLE analysis_sessions ADD COLUMN journal_name TEXT')
            except:
                pass
            
            conn.commit()
            conn.close()
        except Exception as e:
            pass

    def create_analysis_session(self, session_id: str, config: dict):
        """Create new analysis session"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            journal_name = os.path.basename(config.get('journal_pdf_path', 'unknown.pdf'))
            
            cursor.execute('''
            INSERT INTO analysis_sessions (id, config_json, journal_name, status)
            VALUES (?, ?, ?, ?)
            ''', (session_id, json.dumps(config), journal_name, 'pending'))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            return False

    def update_analysis_session(self, session_id: str, **kwargs):
        """Update analysis session"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            update_fields = []
            values = []
            
            for key, value in kwargs.items():
                if key == 'results':
                    update_fields.append('results_json = ?')
                    values.append(json.dumps(value))
                elif key == 'completed_at' and value is True:
                    update_fields.append('completed_at = CURRENT_TIMESTAMP')
                else:
                    update_fields.append(f'{key} = ?')
                    values.append(value)
            
            if update_fields:
                values.append(session_id)
                query = f"UPDATE analysis_sessions SET {', '.join(update_fields)} WHERE id = ?"
                cursor.execute(query, values)
                conn.commit()
            
            conn.close()
            return True
        except Exception as e:
            return False

    def get_analysis_session(self, session_id: str):
        """Get analysis session by ID"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM analysis_sessions WHERE id = ?', (session_id,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                columns = [description[0] for description in cursor.description]
                return dict(zip(columns, row))
            return None
        except Exception as e:
            return None

    def get_analysis_history(self):
        """Get analysis history"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT id, created_at as date, journal_name as journalName,
                   total_comparisons as totalComparisons,
                   high_risk_found as highRiskFound,
                   medium_risk_found as mediumRiskFound,
                   no_risk_found as noRiskFound,
                   (high_risk_found + medium_risk_found) as infringements,
                   CASE 
                       WHEN total_comparisons > 0 
                       THEN ROUND((high_risk_found + medium_risk_found) * 100.0 / total_comparisons, 2)
                       ELSE 0 
                   END as infringementRate,
                   processing_time as processingTime,
                   status
            FROM analysis_sessions
            WHERE status = 'completed'
            ORDER BY created_at DESC
            LIMIT 50
            ''')
            
            results = cursor.fetchall()
            conn.close()
            
            history = []
            for row in results:
                history.append({
                    'id': row[0],
                    'date': row[1],
                    'journalName': row[2] or 'Unknown Journal',
                    'totalComparisons': row[3] or 0,
                    'highRiskFound': row[4] or 0,
                    'mediumRiskFound': row[5] or 0,
                    'noRiskFound': row[6] or 0,
                    'infringements': row[7] or 0,
                    'infringementRate': row[8] or 0,
                    'processingTime': row[9] or 0,
                    'status': row[10] or 'unknown'
                })
            
            return history
        except Exception as e:
            return []

    def get_journal_history(self):
        """Get journal upload history"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT id, journal_no, journal_date, upload_date,
                   total_device_entries, total_word_entries, status, pdf_filename
            FROM journal_metadata
            ORDER BY upload_date DESC
            LIMIT 50
            ''')
            
            results = cursor.fetchall()
            conn.close()
            
            journals = []
            for row in results:
                journals.append({
                    'id': row[0],
                    'journal_no': row[1] or 'N/A',
                    'journal_date': row[2] or 'N/A',
                    'upload_date': row[3],
                    'total_device_entries': row[4] or 0,
                    'total_word_entries': row[5] or 0,
                    'status': row[6] or 'unknown',
                    'pdf_filename': row[7] or 'N/A'
                })
            
            return journals
        except Exception as e:
            return []

    def get_journal_by_id(self, journal_id: str):
        """Get journal by ID"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT id, journal_no, journal_date, upload_date,
                   total_device_entries, total_word_entries, status, pdf_filename, pdf_path
            FROM journal_metadata
            WHERE id = ?
            ''', (journal_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return {
                    'id': row[0],
                    'journal_no': row[1] or 'N/A',
                    'journal_date': row[2] or 'N/A',
                    'upload_date': row[3],
                    'total_device_entries': row[4] or 0,
                    'total_word_entries': row[5] or 0,
                    'status': row[6] or 'unknown',
                    'pdf_filename': row[7] or 'N/A',
                    'pdf_path': row[8] or None
                }
            return None
        except Exception as e:
            return None

    def get_reports(self):
        """Get all exported reports"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT r.id, r.session_id, r.title, r.type, r.format, r.created_at,
                   COALESCE(json_extract(r.data_json, '$.results_count'), 0) as total_results
            FROM exported_reports r
            ORDER BY r.created_at DESC
            LIMIT 50
            ''')
            
            results = cursor.fetchall()
            conn.close()
            
            reports = []
            for row in results:
                reports.append({
                    'id': row[0],
                    'session_id': row[1],
                    'title': row[2],
                    'type': row[3],
                    'format': row[4],
                    'created_at': row[5],
                    'total_results': row[6]
                })
            
            return reports
        except Exception as e:
            return []

# ================================
# ENHANCED ANALYSIS CLASS - FIXED
# ================================

class DatabaseTrademarkAnalyzer:
    def __init__(self, cache_dir="cache"):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)
        
        # Initialize analyzers
        visual_cache = os.path.join(cache_dir, "combined_cache", "visual_cache")
        text_cache = os.path.join(cache_dir, "combined_cache", "text_cache")
        os.makedirs(visual_cache, exist_ok=True)
        os.makedirs(text_cache, exist_ok=True)
        
        self.visual_analyzer = VisualSimilarityAnalyzer(visual_cache)
        self.text_extractor = TextExtractor(text_cache)
        self.text_analyzer = EnhancedTrademarkAnalyzer()
        
        self.results = []
        self.session_id = None
        self.progress_callback = None
        self.start_time = None
        self.performance_stats = {}
        
        # Performance limits
        self.max_journal_device_limit = 50000
        self.max_journal_word_limit = 50000
        self.max_client_device_limit = 2000
        self.max_client_word_limit = 2000
        self.chunk_size = 5

    def set_progress_callback(self, callback):
        self.progress_callback = callback

    def emit_progress(self, step: str, progress: float, **kwargs):
        if self.progress_callback:
            try:
                self.progress_callback(step, progress, **kwargs)
            except Exception as e:
                pass

    def _parse_cache_entry(self, cache_entry):
        """Parse existing cache entry format - EXACT COPY from old code"""
        import re
        
        if not cache_entry:
            return "", ""
        
        # Parse the format: "{comparison_text}, display_text"
        match = re.match(r'\{([^}]*)\},\s*(.*)', cache_entry)
        if match:
            comparison_text = match.group(1).strip()
            display_text = match.group(2).strip()
            return comparison_text, display_text
        else:
            # Fallback for any entries not in the expected format
            return cache_entry, cache_entry

    def _get_comparison_text(self, comparison_text, display_text):
        """Apply special comparison rules - EXACT COPY from old code"""
        # Rule: If comparison text (in brackets) is empty and display text exists,
        # use display text for comparison in those cases only
        if not comparison_text.strip() and display_text.strip():
            return display_text
    
    # Otherwise, use the comparison text (from brackets)
        return comparison_text if comparison_text.strip() else display_text

    def _get_risk_level(self, score: float) -> str:
        """Get risk level based on score"""
        if score >= 70:
            return "High"
        elif score >= 50:
            return "Medium"
        elif score >= 40:
            return "Low"
        else:
            return "No Risk"

    def analyze_device_marks(self, client_marks, journal_marks):
        """Analyze device marks using EXACT logic from working old code"""
        results = []
        
        if not client_marks or not journal_marks:
            return results

        print("🚀 Starting device mark analysis with correct logic...")
        
        # STEP 1: Collect all image paths like in old code
        all_image_paths = []
        for mark in client_marks:
            if mark.get('image_path') and os.path.exists(mark['image_path']):
                all_image_paths.append(mark['image_path'])
        for mark in journal_marks:
            if mark.get('image_path') and os.path.exists(mark['image_path']):
                all_image_paths.append(mark['image_path'])

        if not all_image_paths:
            print("❌ No valid image paths found")
            return results

        # STEP 2: Prepare folders - CRITICAL MISSING STEP
        print("📁 Preparing image features...")
        unique_dirs = list(set([os.path.dirname(path) for path in all_image_paths]))
        self.visual_analyzer.prepare_folders(unique_dirs)
        
        # STEP 3: Extract text from folders - CRITICAL MISSING STEP  
        print("📝 Extracting text from images...")
        self.text_extractor.extract_text_from_folders(unique_dirs)

        processed = 0
        total_pairs = len(client_marks) * len(journal_marks)
        
        print(f"🔍 Processing {total_pairs:,} comparisons...")

        for client_mark in client_marks:
            for journal_mark in journal_marks:
                try:
                    client_img_path = client_mark.get('image_path')
                    journal_img_path = journal_mark.get('image_path')

                    if not client_img_path or not journal_img_path:
                        continue
                    if not os.path.exists(client_img_path) or not os.path.exists(journal_img_path):
                        continue

                    # STEP 4: Calculate visual similarity with tuple handling
                    visual_result = self.visual_analyzer.calculate_visual_similarity(
                        client_img_path, journal_img_path
                    )
                    
                    # Handle tuple return - CRITICAL FIX
                    if isinstance(visual_result, tuple):
                        visual_score, visual_details = visual_result
                    else:
                        visual_score = visual_result
                        visual_details = "No details available"

                    # STEP 5: Extract and parse text using old method
                    img1_text = self.text_extractor.extract_text_from_image(client_img_path)
                    img2_text = self.text_extractor.extract_text_from_image(journal_img_path)

                    # Parse cache entries
                    img1_comparison, img1_display = self._parse_cache_entry(img1_text)
                    img2_comparison, img2_display = self._parse_cache_entry(img2_text)

                    # Apply comparison rules
                    text1_for_comparison = self._get_comparison_text(img1_comparison, img1_display)
                    text2_for_comparison = self._get_comparison_text(img2_comparison, img2_display)

                    # STEP 6: Calculate text similarity with tuple handling
                    text_result = self.text_analyzer.calculate_text_similarity(
                        text1_for_comparison, text2_for_comparison
                    )
                    
                    # Handle tuple return - CRITICAL FIX
                    if isinstance(text_result, tuple):
                        text_score, text_details = text_result
                    else:
                        text_score = text_result
                        text_details = "No details available"

                    # STEP 7: Calculate final score (50% visual + 50% text)
                    final_score = 0.5 * visual_score + 0.5 * text_score

                    # STEP 8: Convert to percentages - CRITICAL FIX
                    visual_score_pct = visual_score * 100
                    text_score_pct = text_score * 100
                    final_score_pct = final_score * 100

                    risk_level = self._get_risk_level(final_score_pct)

                    result = {
                        'id': str(uuid.uuid4()),
                        'client_mark': client_mark,
                        'journal_mark': journal_mark,
                        'risk_level': risk_level,
                        'comparison_type': 'device_mark',
                        'visual_score': visual_score_pct,  # Now in percentage
                        'text_score': text_score_pct,     # Now in percentage
                        'final_score': final_score_pct,   # Now in percentage
                        'visual_details': visual_details,
                        'text_details': text_details,
                        'client_text_display': img1_display,
                        'journal_text_display': img2_display,
                        'text1': text1_for_comparison,
                        'text2': text2_for_comparison,
                        'infringement_detected': final_score >= 0.5
                    }

                    results.append(result)
                    processed += 1

                    # Progress updates every 10 comparisons
                    if processed % 10 == 0:
                        progress = (processed / total_pairs) * 60 + 20
                        self.emit_progress(
                            f"Processing device marks: {processed}/{total_pairs}", 
                            progress, 
                            processed_comparisons=processed
                        )

                except Exception as e:
                    print(f"⚠️ Error processing comparison: {e}")
                    continue

        print(f"✅ Device mark analysis complete! Processed {len(results)} results")
        return results


    def analyze_word_marks(self, client_marks, journal_marks):
        """Analyze word marks using EXACT logic from working old code"""
        results = []
        
        if not client_marks or not journal_marks:
            return results

        print(f"📝 Starting word mark analysis...")
        print(f"🔍 Comparing {len(client_marks)} client vs {len(journal_marks)} journal word marks")

        processed = 0
        total_pairs = len(client_marks) * len(journal_marks)

        for client_mark in client_marks:
            for journal_mark in journal_marks:
                try:
                    # Get text from correct fields
                    client_text = client_mark.get('tm_applied_for', '')
                    journal_text = journal_mark.get('word_mark', '')

                    if not client_text or not journal_text:
                        continue

                    # Calculate text similarity with tuple handling
                    text_result = self.text_analyzer.calculate_text_similarity(
                        client_text, journal_text
                    )
                    
                    # Handle tuple return - CRITICAL FIX
                    if isinstance(text_result, tuple):
                        text_score, text_details = text_result
                    else:
                        text_score = text_result
                        text_details = "No details available"

                    # Convert to percentage - CRITICAL FIX
                    text_score_pct = text_score * 100

                    risk_level = self._get_risk_level(text_score_pct)

                    # Only keep meaningful results (threshold from old code)
                    if text_score > 0.1:
                        result = {
                            'id': str(uuid.uuid4()),
                            'client_mark': client_mark,
                            'journal_mark': journal_mark,
                            'risk_level': risk_level,
                            'comparison_type': 'word_mark',
                            'text_score': text_score_pct,    # Now in percentage
                            'final_score': text_score_pct,   # For word marks, final = text
                            'visual_score': 0,               # No visual for word marks
                            'text_details': text_details,
                            'visual_details': "Word mark comparison",
                            'client_text_display': client_text,
                            'journal_text_display': journal_text,
                            'text1': client_text,
                            'text2': journal_text,
                            'infringement_detected': text_score_pct >= 50
                        }
                        results.append(result)

                    processed += 1

                    # Progress updates every 100 comparisons
                    if processed % 100 == 0:
                        progress = (processed / total_pairs) * 30 + 70
                        self.emit_progress(
                            f"Processing word marks: {processed}/{total_pairs}", 
                            progress, 
                            processed_comparisons=processed
                        )

                except Exception as e:
                    print(f"⚠️ Error processing word comparison: {e}")
                    continue

        print(f"✅ Word mark analysis complete! Generated {len(results)} meaningful results")
        return results


    def get_client_device_marks(self, limit: int = 20):
        """Get client device marks - Fixed version"""
        try:
            # Use correct database name from old code
            db_path = 'client_test_devicemark.db'  # Note: test_ prefix
            if not os.path.exists(db_path):
                print(f"❌ Database not found: {db_path}")
                return []

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT API_appno, API_dateOfApp, API_class, API_status, API_tmAppliedFor,
                API_userDetail, API_validUpto, API_propName, API_buisnessName,
                API_imagepath, API_goodsAndSerice
            FROM trademark_data
            WHERE API_imagepath IS NOT NULL AND API_imagepath != ''
            ORDER BY API_appno DESC
            LIMIT ?
            ''', (limit,))
            
            results = cursor.fetchall()
            conn.close()

            device_marks = []
            for row in results:
                # Verify image path exists
                if row[9] and os.path.exists(row[9]):
                    device_marks.append({
                        'app_no': row[0],
                        'date_of_app': row[1],
                        'class': row[2],
                        'status': row[3],
                        'tm_applied_for': row[4],
                        'user_detail': row[5],
                        'valid_upto': row[6],
                        'prop_name': row[7],
                        'business_name': row[8],
                        'image_path': row[9],
                        'goods_services': row[10]
                    })

            print(f"📱 Loaded {len(device_marks)} client device marks")
            return device_marks
        except Exception as e:
            print(f"Error getting client device marks: {str(e)}")
        return []


    def get_client_word_marks(self, limit: int = 20):
        """Get client word marks from database with correct field mapping"""
        try:
            if not os.path.exists('client_test_wordmark.db'):
                return []

            conn = sqlite3.connect('client_test_wordmark.db')
            cursor = conn.cursor()
            
            cursor.execute('''
            SELECT API_appno, API_dateOfApp, API_class, API_status, API_tmAppliedFor,
                   API_userDetail, API_validUpto, API_propName, API_buisnessName,
                   API_goodsAndSerice
            FROM trademark_data
            WHERE API_tmAppliedFor IS NOT NULL AND API_tmAppliedFor != ''
            ORDER BY API_appno DESC
            LIMIT ?
            ''', (limit,))
            
            results = cursor.fetchall()
            conn.close()

            word_marks = []
            for row in results:
                word_marks.append({
                    'app_no': row[0],
                    'date_of_app': row[1],
                    'class': row[2],
                    'status': row[3],
                    'tm_applied_for': row[4],  # This is the key field
                    'user_detail': row[5],
                    'valid_upto': row[6],
                    'prop_name': row[7],
                    'business_name': row[8],
                    'goods_services': row[9]
                })

            return word_marks
        except Exception as e:
            return []

    def get_journal_device_marks(self, limit: int = 50000):
        """Get device marks from journal database with correct field mapping"""
        if not os.path.exists('journal_devicemark.db'):
            return []

        conn = sqlite3.connect('journal_devicemark.db')
        cursor = conn.cursor()

        try:
            cursor.execute('''
            SELECT application_number, application_date, proprietor_name,
                   address, goods_services, logo_path, class,
                   entity_type, address_for_service, usage_details, location_of_use
            FROM trademarks
            WHERE logo_path IS NOT NULL AND logo_path != ''
            LIMIT ?
            ''', (limit,))
            
            results = cursor.fetchall()
            conn.close()

            device_marks = []
            for row in results:
                if row[5] and os.path.exists(row[5]):  # logo_path exists
                    device_marks.append({
                        'application_number': row[0],
                        'application_date': row[1],
                        'company_name': row[2],  # proprietor_name
                        'address': row[3],
                        'goods_services': row[4],
                        'image_path': row[5],  # logo_path - this is the key field
                        'class': str(row[6]).strip() if row[6] else "",
                        'entity_type': row[7],
                        'address_for_service': row[8],
                        'usage_details': row[9],
                        'location_of_use': row[10],
                        'source': 'journal'
                    })

            return device_marks
        except Exception as e:
            conn.close()
            return []

    def get_journal_word_marks(self, limit: int = 50000):
        """Get word marks from journal database with correct field mapping"""
        if not os.path.exists('journal_wordmark.db'):
            return []

        conn = sqlite3.connect('journal_wordmark.db')
        cursor = conn.cursor()

        try:
            cursor.execute('''
            SELECT application_number, application_date, proprietor_name,
                   address, goods_services, class, proprietor_name,
                   entity_type, address_for_service, usage_details, location_of_use
            FROM trademarks
            WHERE proprietor_name IS NOT NULL AND proprietor_name != ''
            LIMIT ?
            ''', (limit,))
            
            results = cursor.fetchall()
            conn.close()

            word_marks = []
            for row in results:
                word_marks.append({
                    'application_number': row[0],
                    'application_date': row[1],
                    'company_name': row[2],  # proprietor_name
                    'address': row[3],
                    'goods_services': row[4],
                    'class': str(row[5]).strip() if row[5] else "",
                    'word_mark': row[6],  # proprietor_name as word_mark - this is the key field
                    'tm_applied_for': row[6],  # proprietor_name as tm_applied_for
                    'entity_type': row[7],
                    'address_for_service': row[8],
                    'usage_details': row[9],
                    'location_of_use': row[10],
                    'source': 'journal'
                })

            return word_marks
        except Exception as e:
            conn.close()
            return []

    def analyze_device_marks_only(self, journal_pdf_path: str, config: dict):
        """Analyze only device marks"""
        try:
            self.start_time = time.time()
            
            # Process journal PDF
            self.emit_progress("Processing journal PDF...", 5)
            result = process_trademarks(journal_pdf_path)
            
            # Get data
            self.emit_progress("Loading trademark data...", 15)
            journal_device_marks = self.get_journal_device_marks()
            client_device_marks = self.get_client_device_marks(config.get('client_device_limit', 20))
            
            if not client_device_marks or not journal_device_marks:
                raise Exception("No device mark data found for comparison")
            
            total_comparisons = len(client_device_marks) * len(journal_device_marks)
            
            if self.session_id:
                db_manager.update_analysis_session(self.session_id, total_comparisons=total_comparisons)
            
            # Analyze device marks
            self.emit_progress("Analyzing device marks...", 20)
            results = self.analyze_device_marks(client_device_marks, journal_device_marks)
            
            # Sort by highest score first
            results.sort(key=lambda x: (
                x.get('risk_level') == 'No Risk',
                x.get('risk_level') == 'Low',
                x.get('risk_level') == 'Medium',
                -(x.get('final_score', 0))
            ))
            
            # Calculate statistics
            risk_stats = {'High': 0, 'Medium': 0, 'Low': 0, 'No Risk': 0}
            for result in results:
                risk_level = result.get('risk_level', 'No Risk')
                risk_stats[risk_level] = risk_stats.get(risk_level, 0) + 1
            
            processing_time = time.time() - self.start_time
            
            # Update session
            if self.session_id:
                db_manager.update_analysis_session(
                    self.session_id,
                    results=results,
                    status='completed',
                    completed_at=True,
                    processing_time=processing_time,
                    processed_comparisons=len(results),
                    high_risk_found=risk_stats['High'],
                    medium_risk_found=risk_stats['Medium'],
                    no_risk_found=risk_stats['No Risk']
                )
            
            self.emit_progress("Analysis complete!", 100, processed_comparisons=len(results))
            
            return {
                'results': results,
                'summary': {
                    'total_comparisons': total_comparisons,
                    'processed_comparisons': len(results),
                    'high_risk': risk_stats['High'],
                    'medium_risk': risk_stats['Medium'],
                    'low_risk': risk_stats['Low'],
                    'no_risk': risk_stats['No Risk'],
                    'processing_time': processing_time
                }
            }
            
        except Exception as e:
            if self.session_id:
                db_manager.update_analysis_session(self.session_id, status='failed', error_message=str(e), completed_at=True)
            raise

    def analyze_word_marks_only(self, journal_pdf_path: str, config: dict):
        """Analyze only word marks"""
        try:
            self.start_time = time.time()
            
            # Process journal PDF
            self.emit_progress("Processing journal PDF...", 5)
            result = process_trademarks(journal_pdf_path)
            
            # Get data
            self.emit_progress("Loading trademark data...", 15)
            journal_word_marks = self.get_journal_word_marks()
            client_word_marks = self.get_client_word_marks(config.get('client_word_limit', 20))
            
            if not client_word_marks or not journal_word_marks:
                raise Exception("No word mark data found for comparison")
            
            total_comparisons = len(client_word_marks) * len(journal_word_marks)
            
            if self.session_id:
                db_manager.update_analysis_session(self.session_id, total_comparisons=total_comparisons)
            
            # Analyze word marks
            self.emit_progress("Analyzing word marks...", 20)
            results = self.analyze_word_marks(client_word_marks, journal_word_marks)
            
            # Sort by highest score first
            results.sort(key=lambda x: (
                x.get('risk_level') == 'No Risk',
                x.get('risk_level') == 'Low',
                x.get('risk_level') == 'Medium',
                -(x.get('final_score', 0))
            ))
            
            # Calculate statistics
            risk_stats = {'High': 0, 'Medium': 0, 'Low': 0, 'No Risk': 0}
            for result in results:
                risk_level = result.get('risk_level', 'No Risk')
                risk_stats[risk_level] = risk_stats.get(risk_level, 0) + 1
            
            processing_time = time.time() - self.start_time
            
            # Update session
            if self.session_id:
                db_manager.update_analysis_session(
                    self.session_id,
                    results=results,
                    status='completed',
                    completed_at=True,
                    processing_time=processing_time,
                    processed_comparisons=len(results),
                    high_risk_found=risk_stats['High'],
                    medium_risk_found=risk_stats['Medium'],
                    no_risk_found=risk_stats['No Risk']
                )
            
            self.emit_progress("Analysis complete!", 100, processed_comparisons=len(results))
            
            return {
                'results': results,
                'summary': {
                    'total_comparisons': total_comparisons,
                    'processed_comparisons': len(results),
                    'high_risk': risk_stats['High'],
                    'medium_risk': risk_stats['Medium'],
                    'low_risk': risk_stats['Low'],
                    'no_risk': risk_stats['No Risk'],
                    'processing_time': processing_time
                }
            }
            
        except Exception as e:
            if self.session_id:
                db_manager.update_analysis_session(self.session_id, status='failed', error_message=str(e), completed_at=True)
            raise

# ================================
# PYDANTIC MODELS
# ================================

class SimilarityRequest(BaseModel):
    client_device_limit: int = Field(default=20, ge=1)
    client_word_limit: Optional[int] = Field(default=20, ge=1)
    visual_weight: float = Field(default=0.5, ge=0, le=1)
    text_weight: float = Field(default=0.5, ge=0, le=1)

class AnalysisStatus(BaseModel):
    session_id: str
    status: str
    progress_percent: float = 0
    current_step: str = ""
    total_comparisons: int = 0
    processed_comparisons: int = 0
    high_risk_found: int = 0
    medium_risk_found: int = 0
    no_risk_found: int = 0
    processing_time: float = 0
    estimated_remaining_time: Optional[float] = None

class AnalysisResult(BaseModel):
    session_id: str
    total_reference_images: int
    processed_reference_images: int
    total_processing_time: float
    summary: Dict[str, Any]
    batch_results: List[Dict[str, Any]]
    pagination: Dict[str, int]

# ================================
# ASYNC BACKGROUND TASKS
# ================================

# Global variables
analysis_sessions = {}
websocket_connections = {}
executor = ThreadPoolExecutor(max_workers=4)

# Initialize database manager
db_manager = DatabaseManager()

async def run_device_analysis_task_async(session_id: str, journal_pdf_path: str, config: dict):
    """Async background task for device mark analysis"""
    try:
        db_manager.update_analysis_session(session_id, status='running')
        
        analyzer = DatabaseTrademarkAnalyzer()
        analyzer.session_id = session_id
        analyzer.start_time = time.time()

        def progress_callback(step: str, progress: float, **kwargs):
            try:
                update_data = {key: value for key, value in kwargs.items()}
                db_manager.update_analysis_session(session_id, **update_data)
            except Exception as e:
                pass

        analyzer.set_progress_callback(progress_callback)

        loop = asyncio.get_event_loop()
        results = await asyncio.wait_for(
            loop.run_in_executor(
                executor,
                analyzer.analyze_device_marks_only,
                journal_pdf_path,
                config
            ),
            timeout=1800
        )

    except asyncio.TimeoutError:
        db_manager.update_analysis_session(
            session_id,
            status='failed',
            error_message="Analysis timed out after 30 minutes",
            completed_at=True
        )
    except Exception as e:
        db_manager.update_analysis_session(
            session_id,
            status='failed',
            error_message=str(e),
            completed_at=True
        )

async def run_word_analysis_task_async(session_id: str, journal_pdf_path: str, config: dict):
    """Async background task for word mark analysis"""
    try:
        db_manager.update_analysis_session(session_id, status='running')
        
        analyzer = DatabaseTrademarkAnalyzer()
        analyzer.session_id = session_id
        analyzer.start_time = time.time()

        def progress_callback(step: str, progress: float, **kwargs):
            try:
                update_data = {key: value for key, value in kwargs.items()}
                db_manager.update_analysis_session(session_id, **update_data)
            except Exception as e:
                pass

        analyzer.set_progress_callback(progress_callback)

        loop = asyncio.get_event_loop()
        results = await asyncio.wait_for(
            loop.run_in_executor(
                executor,
                analyzer.analyze_word_marks_only,
                journal_pdf_path,
                config
            ),
            timeout=1800
        )

    except asyncio.TimeoutError:
        db_manager.update_analysis_session(
            session_id,
            status='failed',
            error_message="Analysis timed out after 30 minutes",
            completed_at=True
        )
    except Exception as e:
        db_manager.update_analysis_session(
            session_id,
            status='failed',
            error_message=str(e),
            completed_at=True
        )

def signal_handler(sig, frame):
    """Handle shutdown signals gracefully"""
    if hasattr(db_manager, 'conn') and db_manager.conn:
        db_manager.conn.close()
    if executor:
        executor.shutdown(wait=True)
    exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)
