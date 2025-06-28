import os
import uuid
import asyncio
import json
import math
import time
from datetime import datetime
from typing import Optional, List, Dict, Any
import sqlite3
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi import Form, File, UploadFile, BackgroundTasks

# Import all logic from backend
from backend import (
    DatabaseManager, DatabaseTrademarkAnalyzer, AnalysisStatus, AnalysisResult,
    SimilarityRequest, convert_path_to_url, run_device_analysis_task_async, run_word_analysis_task_async,
    db_manager, websocket_connections, analysis_sessions
)

# Create FastAPI app
app = FastAPI(
    title="Trademark Similarity Analysis API",
    description="Advanced trademark analysis using visual and text similarity",
    version="1.0.0"
)

# Mount static file directories for image serving
if os.path.exists("trademark_images"):
    app.mount("/trademark_images", StaticFiles(directory="trademark_images"), name="trademark_images")
if os.path.exists("extracted_logos"):
    app.mount("/extracted_logos", StaticFiles(directory="extracted_logos"), name="extracted_logos")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================================
# COMBINED ANALYSIS TASK
# ================================

async def run_combined_analysis_task_async(session_id: str, journal_pdf_path: str, config: dict):
    """Run both device and word mark analysis"""
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

        # Run combined analysis
        loop = asyncio.get_event_loop()
        device_results = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                analyzer.analyze_device_marks_only,
                journal_pdf_path,
                config
            ),
            timeout=1800
        )

        word_results = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                analyzer.analyze_word_marks_only,
                journal_pdf_path,
                config
            ),
            timeout=1800
        )

        # Combine results
        combined_results = device_results['results'] + word_results['results']

        # UPDATED SORTING: High Risk -> Medium Risk -> Low Risk -> No Risk, then by score descending
        def risk_priority(risk_level):
            """Convert risk level to priority number for sorting"""
            priority_map = {'High': 1, 'Medium': 2, 'Low': 3, 'No Risk': 4}
            return priority_map.get(risk_level, 5)

        combined_results.sort(key=lambda x: (
            risk_priority(x.get('risk_level', 'No Risk')),  # Risk level priority first
            -(x.get('final_score', 0))  # Then by score descending within each risk level
        ))

        # Calculate combined statistics
        risk_stats = {'High': 0, 'Medium': 0, 'Low': 0, 'No Risk': 0}
        for result in combined_results:
            risk_level = result.get('risk_level', 'No Risk')
            risk_stats[risk_level] = risk_stats.get(risk_level, 0) + 1

        processing_time = time.time() - analyzer.start_time
        total_comparisons = device_results['summary']['total_comparisons'] + word_results['summary']['total_comparisons']

        # Update session with combined results
        db_manager.update_analysis_session(
            session_id,
            results=combined_results,
            status='completed',
            completed_at=True,
            processing_time=processing_time,
            processed_comparisons=len(combined_results),
            total_comparisons=total_comparisons,
            high_risk_found=risk_stats['High'],
            medium_risk_found=risk_stats['Medium'],
            no_risk_found=risk_stats['No Risk']
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


# ================================
# API ENDPOINTS
# ================================

@app.get("/")
async def root():
    return {"message": "Trademark Similarity Analysis API", "version": "1.0.0"}

@app.post("/api/analysis/start")
async def start_analysis(
    background_tasks: BackgroundTasks,
    journal_pdf: UploadFile = File(...),
    analysis_type: str = Form(...),
    client_device_limit: int = Form(20),
    client_word_limit: int = Form(20),
    visual_weight: float = Form(0.5),
    text_weight: float = Form(0.5)
):
    """Single endpoint to start any type of analysis"""
    # Enhanced logging
    print(f"🔍 Analysis Request Received:")
    print(f" 📄 PDF: {journal_pdf.filename} ({getattr(journal_pdf, 'size', 'unknown')} bytes)")
    print(f" 🔧 Analysis Type: '{analysis_type}'")
    print(f" 📊 Device Limit: {client_device_limit}")
    print(f" 📝 Word Limit: {client_word_limit}")
    print(f" 👁️ Visual Weight: {visual_weight}")
    print(f" 📝 Text Weight: {text_weight}")

    # Validate required fields
    if not journal_pdf or not journal_pdf.filename:
        print("❌ No file uploaded")
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    if not journal_pdf.filename.lower().endswith('.pdf'):
        print(f"❌ Invalid file type: {journal_pdf.filename}")
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Validate analysis_type
    valid_types = ["device_marks", "word_marks", "both"]
    if not analysis_type:
        print("❌ No analysis_type provided")
        raise HTTPException(status_code=400, detail="analysis_type is required")
        
    if analysis_type not in valid_types:
        print(f"❌ Invalid analysis_type: '{analysis_type}'")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid analysis_type '{analysis_type}'. Must be one of: {', '.join(valid_types)}"
        )

    try:
        # Generate session ID
        session_id = str(uuid.uuid4())
        print(f"📝 Generated session ID: {session_id}")

        # Save file
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)
        pdf_path = os.path.join(upload_dir, f"{session_id}_{journal_pdf.filename}")
        
        with open(pdf_path, "wb") as buffer:
            content = await journal_pdf.read()
            if len(content) == 0:
                raise HTTPException(status_code=400, detail="Uploaded file is empty")
            buffer.write(content)
        
        print(f"💾 PDF saved: {pdf_path} ({len(content)} bytes)")

        # Create config
        config_dict = {
            'analysis_type': analysis_type,
            'client_device_limit': min(client_device_limit, 20),
            'client_word_limit': min(client_word_limit, 20),
            'visual_weight': visual_weight,
            'text_weight': text_weight,
            'journal_pdf_path': pdf_path
        }

        # Create session in database
        db_manager.create_analysis_session(session_id, config_dict)
        print(f"✅ Session created in database: {session_id}")

        # Start appropriate analysis task
        if analysis_type == "device_marks":
            background_tasks.add_task(run_device_analysis_task_async, session_id, pdf_path, config_dict)
            estimated_time = "2-5 minutes"
        elif analysis_type == "word_marks":
            background_tasks.add_task(run_word_analysis_task_async, session_id, pdf_path, config_dict)
            estimated_time = "1-3 minutes"
        elif analysis_type == "both":
            background_tasks.add_task(run_combined_analysis_task_async, session_id, pdf_path, config_dict)
            estimated_time = "3-8 minutes"

        print(f"🚀 Background task started for {analysis_type} analysis")

        response = {
            "session_id": session_id,
            "status": "started",
            "analysis_type": analysis_type,
            "estimated_time": estimated_time
        }

        print(f"📤 Returning response: {response}")
        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        import traceback
        print(f"❌ Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/analysis/{session_id}/status")
async def get_analysis_status(session_id: str):
    """Get analysis status with progress information"""
    session = db_manager.get_analysis_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    progress_percent = 0
    if session.get('total_comparisons', 0) > 0:
        progress_percent = (session.get('processed_comparisons', 0) / session['total_comparisons']) * 100

    # Add explicit completion flags
    is_complete = session['status'] in ['completed', 'failed']
    
    return {
        "session_id": session_id,
        "status": session['status'],
        "is_complete": is_complete,  # Add this flag
        "should_stop_polling": is_complete,  # Explicit polling control
        "progress_percent": progress_percent,
        "current_step": f"Processed {session.get('processed_comparisons', 0)} of {session.get('total_comparisons', 0)} comparisons",
        "total_comparisons": session.get('total_comparisons', 0),
        "processed_comparisons": session.get('processed_comparisons', 0),
        "high_risk_found": session.get('high_risk_found', 0),
        "medium_risk_found": session.get('medium_risk_found', 0),
        "no_risk_found": session.get('no_risk_found', 0),
        "processing_time": session.get('processing_time', 0)
    }


# ================================
# SINGLE UNIFIED RESULTS ENDPOINT
# ================================

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        print(f"🔴 Unhandled exception in {request.url}: {exc}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {str(exc)}"}
        )


@app.get("/api/analysis/{session_id}/results")
async def get_analysis_results(
    session_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Results per page"),
    exclude_no_risk: str = Query("true", description="Exclude no risk results"),
    comparison_type: Optional[str] = Query(None, description="Filter by 'device', 'word', or leave empty for all")
):
    """Get analysis results with comprehensive error handling"""
    try:
        # Convert string boolean to actual boolean
        exclude_no_risk_bool = exclude_no_risk.lower() in ('true', '1', 'yes', 'on')
        
        print(f"📊 Results request: session={session_id}, page={page}, per_page={per_page}, exclude_no_risk={exclude_no_risk_bool}")
        
        # Step 1: Check if session exists
        print(f"🔍 Step 1: Checking session existence...")
        session = db_manager.get_analysis_session(session_id)
        if not session:
            print(f"❌ Session not found: {session_id}")
            raise HTTPException(status_code=404, detail="Analysis session not found")
        
        print(f"✅ Session found with status: {session.get('status')}")

        # Step 2: Check session status
        print(f"🔍 Step 2: Checking session status...")
        session_status = session.get('status')
        if session_status != 'completed':
            print(f"❌ Session not completed. Status: {session_status}")
            raise HTTPException(
                status_code=400, 
                detail=f"Analysis not completed yet. Current status: {session_status}"
            )
        
        print(f"✅ Session is completed")

        # Step 3: Check if results exist
        print(f"🔍 Step 3: Checking results existence...")
        results_json = session.get('results_json')
        if not results_json:
            print(f"❌ No results_json found in session")
            # Let's check what keys are available in the session
            print(f"🔍 Available session keys: {list(session.keys())}")
            raise HTTPException(status_code=404, detail="No results found for this session")
        
        print(f"✅ Results JSON found, length: {len(results_json)}")

        # Step 4: Parse results
        print(f"🔍 Step 4: Parsing results JSON...")
        try:
            all_results = json.loads(results_json)
        except json.JSONDecodeError as e:
            print(f"❌ JSON parsing error: {e}")
            print(f"🔍 First 200 chars of results_json: {results_json[:200]}")
            raise HTTPException(status_code=500, detail=f"Failed to parse analysis results: {str(e)}")
        except Exception as e:
            print(f"❌ Unexpected parsing error: {e}")
            raise HTTPException(status_code=500, detail=f"Error parsing results: {str(e)}")

        # Step 5: Validate results format
        print(f"🔍 Step 5: Validating results format...")
        if not isinstance(all_results, list):
            print(f"❌ Results is not a list. Type: {type(all_results)}")
            raise HTTPException(status_code=500, detail="Invalid results format - expected list")

        print(f"✅ Total results loaded: {len(all_results)}")
        
        # Step 6: Filter results
        print(f"🔍 Step 6: Filtering results...")
        filtered_results = all_results
        
        if exclude_no_risk_bool:
            before_filter = len(filtered_results)
            filtered_results = [r for r in all_results if r.get('risk_level') != 'No Risk']
            print(f"📊 After excluding No Risk: {len(filtered_results)} results (was {before_filter})")
        
        # Step 7: Apply comparison type filter
        if comparison_type:
            print(f"🔍 Step 7: Applying comparison type filter: {comparison_type}")
            before_filter = len(filtered_results)
            if comparison_type.lower() == 'device':
                filtered_results = [r for r in filtered_results if r.get('comparison_type') == 'device_mark']
            elif comparison_type.lower() == 'word':
                filtered_results = [r for r in filtered_results if r.get('comparison_type') == 'word_mark']
            else:
                print(f"❌ Invalid comparison_type: {comparison_type}")
                raise HTTPException(status_code=400, detail="comparison_type must be 'device', 'word', or omitted")
            print(f"📊 After {comparison_type} filter: {len(filtered_results)} results (was {before_filter})")

        # Step 8: Sort results
        print(f"🔍 Step 8: Sorting results...")
        def risk_priority(risk_level):
            priority_map = {'High': 1, 'Medium': 2, 'Low': 3, 'No Risk': 4}
            return priority_map.get(risk_level, 5)

        try:
            filtered_results.sort(key=lambda x: (
                risk_priority(x.get('risk_level', 'No Risk')),
                -(x.get('final_score', 0))
            ))
            print(f"✅ Results sorted successfully")
        except Exception as e:
            print(f"❌ Error sorting results: {e}")
            # Continue without sorting
            pass

        # Step 9: Calculate statistics
        print(f"🔍 Step 9: Calculating statistics...")
        try:
            all_device_count = sum(1 for r in filtered_results if r.get('comparison_type') == 'device_mark')
            all_word_count = sum(1 for r in filtered_results if r.get('comparison_type') == 'word_mark')
            high_risk_count = sum(1 for r in filtered_results if r.get('risk_level') == 'High')
            medium_risk_count = sum(1 for r in filtered_results if r.get('risk_level') == 'Medium')
            low_risk_count = sum(1 for r in filtered_results if r.get('risk_level') == 'Low')
            
            print(f"📊 Statistics: High={high_risk_count}, Medium={medium_risk_count}, Low={low_risk_count}")
        except Exception as e:
            print(f"❌ Error calculating statistics: {e}")
            # Set default values
            all_device_count = all_word_count = high_risk_count = medium_risk_count = low_risk_count = 0

        # Step 10: Apply pagination
        print(f"🔍 Step 10: Applying pagination...")
        total = len(filtered_results)
        start = (page - 1) * per_page
        end = start + per_page
        paginated_results = filtered_results[start:end]

        print(f"📊 Paginated results: {len(paginated_results)} (page {page}, per_page {per_page}, total {total})")

        # Step 11: Format results for frontend
        print(f"🔍 Step 11: Formatting results...")
        batch_results = []
        
        for i, result in enumerate(paginated_results):
            try:
                client_mark = result.get('client_mark', {})
                journal_mark = result.get('journal_mark', {})

                # Basic formatting without complex operations first
                formatted_result = {
                    "id": result.get('id', str(uuid.uuid4())),
                    "risk_level": result.get('risk_level', 'No Risk'),
                    "comparison_type": result.get('comparison_type', 'device_mark'),
                    "final_score": round(float(result.get('final_score', 0)), 2),
                    "visual_score": round(float(result.get('visual_score', 0)), 2),
                    "text_score": round(float(result.get('text_score', 0)), 2),
                    "logo_name": journal_mark.get('company_name', f"Result {i+1}"),
                    "logo_path": journal_mark.get('image_path', '/placeholder.svg'),
                    "text1": result.get('text1', ''),
                    "text2": result.get('text2', ''),
                    "infringement_detected": result.get('infringement_detected', False),
                    "client_mark": {
                        "application_number": client_mark.get('application_number', client_mark.get('app_no', 'N/A')),
                        "business_name": client_mark.get('business_name', client_mark.get('prop_name', 'N/A')),
                        "class": str(client_mark.get('class', 'N/A')),
                        "date_of_app": client_mark.get('date_of_app', 'N/A'),
                        "status": client_mark.get('status', 'N/A'),
                        "class_description": client_mark.get('goods_services', client_mark.get('class_description', 'N/A'))
                    },
                    "journal_mark": {
                        "application_number": journal_mark.get('application_number', 'N/A'),
                        "company_name": journal_mark.get('company_name', 'N/A'),
                        "class": str(journal_mark.get('class', 'N/A')),
                        "application_date": journal_mark.get('application_date', 'N/A'),
                        "journal_date": journal_mark.get('journal_date', 'N/A'),
                        "class_description": journal_mark.get('goods_services', journal_mark.get('class_description', 'N/A'))
                    },
                    "client_text_display": result.get('client_text_display', ''),
                    "journal_text_display": result.get('journal_text_display', ''),
                    "text_details": result.get('text_details', ''),
                    "visual_details": result.get('visual_details', '')
                }
                batch_results.append(formatted_result)
                
            except Exception as e:
                print(f"❌ Error formatting result {i}: {e}")
                continue

        print(f"✅ Formatted {len(batch_results)} results successfully")

        # Step 12: Build response
        print(f"🔍 Step 12: Building final response...")
        
        response_data = {
            "session_id": session_id,
            "total_reference_images": session.get('total_comparisons', 0),
            "processed_reference_images": session.get('processed_comparisons', 0),
            "total_processing_time": session.get('processing_time', 0),
            "summary": {
                "total_comparisons": session.get('total_comparisons', 0),
                "high_risk_found": high_risk_count,
                "medium_risk_found": medium_risk_count,
                "low_risk_found": low_risk_count,
                "no_risk_found": session.get('no_risk_found', 0),
                "device_mark_count": all_device_count,
                "word_mark_count": all_word_count,
                "filtered_total": len(filtered_results),
                "total_infringements": high_risk_count + medium_risk_count + low_risk_count
            },
            "batch_results": batch_results,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total_pages": math.ceil(total / per_page) if total > 0 else 1,
                "total": total
            }
        }
        
        print(f"✅ Response built successfully with {len(batch_results)} batch results")
        return response_data

    except HTTPException as he:
        # Re-raise HTTP exceptions with logging
        print(f"🔴 HTTPException: {he.status_code} - {he.detail}")
        raise he
    except Exception as e:
        print(f"❌ Unexpected error in results endpoint: {e}")
        import traceback
        print(f"🔍 Full traceback:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")



# Add this debug endpoint to check database status
@app.get("/api/debug/database-status")
async def check_database_status():
    """Check if required databases exist and are accessible"""
    db_status = {}
    
    # Check client database
    client_db_path = 'client_test_devicemark.db'
    db_status['client_db'] = {
        'path': client_db_path,
        'exists': os.path.exists(client_db_path),
        'readable': False,
        'record_count': 0
    }
    
    if os.path.exists(client_db_path):
        try:
            conn = sqlite3.connect(client_db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM trademark_data WHERE API_imagepath IS NOT NULL")
            db_status['client_db']['record_count'] = cursor.fetchone()[0]
            db_status['client_db']['readable'] = True
            conn.close()
        except Exception as e:
            db_status['client_db']['error'] = str(e)
    
    # Check journal database
    journal_db_path = 'journal_devicemark.db'
    db_status['journal_db'] = {
        'path': journal_db_path,
        'exists': os.path.exists(journal_db_path),
        'readable': False,
        'record_count': 0
    }
    
    if os.path.exists(journal_db_path):
        try:
            conn = sqlite3.connect(journal_db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM trademarks WHERE logo_path IS NOT NULL")
            db_status['journal_db']['record_count'] = cursor.fetchone()[0]
            db_status['journal_db']['readable'] = True
            conn.close()
        except Exception as e:
            db_status['journal_db']['error'] = str(e)
    
    return db_status


@app.get("/api/analysis/{session_id}/results-simple")
async def get_analysis_results_simple(session_id: str):
    """Simplified results endpoint for debugging"""
    try:
        print(f"🔍 Simple results test for session: {session_id}")
        
        session = db_manager.get_analysis_session(session_id)
        if not session:
            return {"error": "Session not found"}
        
        return {
            "session_id": session_id,
            "status": session.get('status'),
            "has_results": bool(session.get('results_json')),
            "results_length": len(session.get('results_json', '')),
            "message": "Simple endpoint working"
        }
    except Exception as e:
        print(f"❌ Error in simple endpoint: {e}")
        return {"error": str(e)}


@app.get("/api/analysis/{session_id}/debug")
async def debug_session(session_id: str):
    """Debug endpoint to check session state"""
    try:
        session = db_manager.get_analysis_session(session_id)
        if not session:
            return {"error": "Session not found", "session_id": session_id}

        debug_info = {
            "session_id": session_id,
            "status": session.get('status'),
            "has_results": bool(session.get('results_json')),
            "results_length": len(session.get('results_json', '')) if session.get('results_json') else 0,
            "total_comparisons": session.get('total_comparisons'),
            "processed_comparisons": session.get('processed_comparisons'),
            "completed_at": session.get('completed_at'),
            "error_message": session.get('error_message')
        }

        # Try to parse results
        if session.get('results_json'):
            try:
                results = json.loads(session['results_json'])
                debug_info["parsed_results_count"] = len(results)
                debug_info["sample_result"] = results[0] if results else None
            except Exception as e:
                debug_info["parse_error"] = str(e)

        return debug_info

    except Exception as e:
        return {"error": str(e), "session_id": session_id}


@app.get("/api/analysis/{session_id}/risk-breakdown")
async def get_risk_breakdown(session_id: str):
    """Get detailed risk level breakdown"""
    session = db_manager.get_analysis_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    if session['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Analysis not completed yet")

    try:
        all_results = json.loads(session['results_json'])
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to parse results")

    # Categorize by risk level
    risk_breakdown = {
        'High': [],
        'Medium': [],
        'Low': [],
        'No Risk': []
    }

    for result in all_results:
        risk_level = result.get('risk_level', 'No Risk')
        if risk_level in risk_breakdown:
            risk_breakdown[risk_level].append({
                'final_score': result.get('final_score', 0),
                'comparison_type': result.get('comparison_type', 'unknown')
            })

    # Calculate statistics for each risk level
    stats = {}
    for risk_level, results in risk_breakdown.items():
        if results:
            scores = [r['final_score'] for r in results]
            stats[risk_level] = {
                'count': len(results),
                'max_score': max(scores),
                'min_score': min(scores),
                'avg_score': sum(scores) / len(scores),
                'device_count': sum(1 for r in results if r['comparison_type'] == 'device_mark'),
                'word_count': sum(1 for r in results if r['comparison_type'] == 'word_mark')
            }
        else:
            stats[risk_level] = {
                'count': 0,
                'max_score': 0,
                'min_score': 0,
                'avg_score': 0,
                'device_count': 0,
                'word_count': 0
            }

    return {
        'session_id': session_id,
        'risk_breakdown': stats,
        'total_results': len(all_results)
    }


@app.get("/api/analysis/{session_id}/summary")
async def get_analysis_summary(session_id: str):
    """Get overall analysis summary for dashboard"""
    session = db_manager.get_analysis_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session['status'] != 'completed':
        progress = 0
        if session.get('total_comparisons', 0) > 0:
            progress = (session.get('processed_comparisons', 0) / session['total_comparisons']) * 100

        return {
            "session_id": session_id,
            "status": session['status'],
            "progress": progress,
            "current_step": f"Processed {session.get('processed_comparisons', 0)} of {session.get('total_comparisons', 0)} comparisons"
        }

    all_results = json.loads(session['results_json'])
    device_results = [r for r in all_results if r.get('comparison_type') == 'device_mark']
    word_results = [r for r in all_results if r.get('comparison_type') == 'word_mark']

    return {
        "session_id": session_id,
        "status": "completed",
        "total_comparisons": session.get('total_comparisons', 0),
        "processing_time": session.get('processing_time', 0),
        "device_marks": {
            "total": len(device_results),
            "high_risk": sum(1 for r in device_results if r.get('risk_level') == 'High'),
            "medium_risk": sum(1 for r in device_results if r.get('risk_level') == 'Medium'),
            "low_risk": sum(1 for r in device_results if r.get('risk_level') == 'Low')
        },
        "word_marks": {
            "total": len(word_results),
            "high_risk": sum(1 for r in word_results if r.get('risk_level') == 'High'),
            "medium_risk": sum(1 for r in word_results if r.get('risk_level') == 'Medium'),
            "low_risk": sum(1 for r in word_results if r.get('risk_level') == 'Low')
        }
    }

# ================================
# OTHER ENDPOINTS (UNCHANGED)
# ================================

@app.get("/api/analysis/history")
async def get_analysis_history():
    """Get analysis history"""
    try:
        history = db_manager.get_analysis_history()
        return history if history else []
    except Exception as e:
        return []

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

@app.get("/api/clients")
async def get_client_data():
    """Get client trademark data summary"""
    device_count = 0
    word_count = 0

    if os.path.exists('client_test_devicemark.db'):
        try:
            conn = sqlite3.connect('client_test_devicemark.db')
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM trademark_data WHERE API_imagepath IS NOT NULL AND API_imagepath != ""')
            device_count = cursor.fetchone()[0]
            conn.close()
        except Exception as e:
            device_count = 0

    if os.path.exists('client_test_wordmark.db'):
        try:
            conn = sqlite3.connect('client_test_wordmark.db')
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM trademark_data WHERE API_tmAppliedFor IS NOT NULL AND API_tmAppliedFor != ""')
            word_count = cursor.fetchone()[0]
            conn.close()
        except Exception as e:
            word_count = 0

    return {
        "device_marks": device_count,
        "word_marks": word_count,
        "total": device_count + word_count
    }

@app.get("/api/reports")
async def get_reports():
    """Get all exported reports"""
    try:
        reports = db_manager.get_reports()
        return {"reports": reports} if reports else {"reports": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch reports: {str(e)}")

@app.get("/api/journals")
async def get_journals():
    """Get all uploaded journals"""
    try:
        journals = db_manager.get_journal_history()
        return journals if journals else []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch journals: {str(e)}")

@app.get("/api/journals/{journal_id}")
async def get_journal_details(journal_id: str):
    """Get individual journal details"""
    try:
        journal = db_manager.get_journal_by_id(journal_id)
        if not journal:
            raise HTTPException(status_code=404, detail="Journal not found")
        return journal
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch journal details: {str(e)}")

@app.post("/api/reports/export")
async def export_report(
    session_id: str = Form(...),
    title: str = Form(...),
    report_type: str = Form("analysis"),
    format: str = Form("pdf")
):
    """Export analysis results as report"""
    try:
        session = db_manager.get_analysis_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Analysis session not found")

        if session['status'] != 'completed':
            raise HTTPException(status_code=400, detail="Analysis not completed yet")

        # Generate report ID
        report_id = str(uuid.uuid4())

        # Store export request
        export_data = {
            "session_id": session_id,
            "title": title,
            "type": report_type,
            "format": format,
            "results_count": session.get('total_comparisons', 0)
        }

        # Insert into exported_reports table
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO exported_reports (id, session_id, title, type, format, data_json, file_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            report_id,
            session_id,
            title,
            report_type,
            format,
            json.dumps(export_data),
            f"reports/{report_id}.{format}"
        ))
        conn.commit()
        conn.close()

        return {
            "report_id": report_id,
            "message": "Report export request created successfully",
            "title": title,
            "format": format
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export report: {str(e)}")

@app.get("/api/clients/device-marks")
async def get_client_device_marks():
    """Get all client device marks from database with proper image URLs"""
    if not os.path.exists('client_test_devicemark.db'):
        return []

    try:
        conn = sqlite3.connect('client_test_devicemark.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT API_appno, API_dateOfApp, API_class, API_status, API_tmAppliedFor,
                   API_userDetail, API_validUpto, API_propName, API_buisnessName,
                   API_imagepath, API_goodsAndSerice
            FROM trademark_data
            WHERE API_imagepath IS NOT NULL AND API_imagepath != ''
            ORDER BY API_appno DESC
            LIMIT 1000
        ''')
        results = cursor.fetchall()
        conn.close()

        device_marks = []
        for row in results:
            local_path = row[9]
            web_url = convert_path_to_url(local_path)
            device_marks.append({
                'API_appno': row[0],
                'API_dateOfApp': row[1],
                'API_class': row[2],
                'API_status': row[3],
                'API_tmAppliedFor': row[4],
                'API_userDetail': row[5],
                'API_validUpto': row[6],
                'API_propName': row[7],
                'API_buisnessName': row[8],
                'API_imagepath': web_url,
                'API_goodsAndserice': row[10]
            })
        return device_marks
    except Exception as e:
        return []

@app.get("/api/clients/word-marks")
async def get_client_word_marks():
    """Get all client word marks from database"""
    if not os.path.exists('client_test_wordmark.db'):
        return []

    try:
        conn = sqlite3.connect('client_test_wordmark.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT API_appno, API_dateOfApp, API_class, API_status, API_tmAppliedFor,
                   API_userDetail, API_validUpto, API_propName, API_buisnessName,
                   API_goodsAndserice
            FROM trademark_data
            WHERE API_tmAppliedFor IS NOT NULL AND API_tmAppliedFor != ''
            ORDER BY API_appno DESC
            LIMIT 1000
        ''')
        results = cursor.fetchall()
        conn.close()

        word_marks = []
        for row in results:
            word_marks.append({
                'API_appno': row[0],
                'API_dateOfApp': row[1],
                'API_class': row[2],
                'API_status': row[3],
                'API_tmAppliedFor': row[4],
                'API_userDetail': row[5],
                'API_validUpto': row[6],
                'API_propName': row[7],
                'API_buisnessName': row[8],
                'API_goodsAndserice': row[9]
            })
        return word_marks
    except Exception as e:
        return []

# WebSocket endpoint for real-time progress updates
@app.websocket("/api/analysis/{session_id}/progress")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    websocket_connections[session_id] = websocket
    
    try:
        while True:
            # Keep connection alive and send progress updates
            session = db_manager.get_analysis_session(session_id)
            if session:
                progress_data = {
                    "session_id": session_id,
                    "status": session.get('status', 'unknown'),
                    "progress_percent": 0,
                    "processed_comparisons": session.get('processed_comparisons', 0),
                    "total_comparisons": session.get('total_comparisons', 0)
                }

                if session.get('total_comparisons', 0) > 0:
                    progress_data["progress_percent"] = (session.get('processed_comparisons', 0) / session['total_comparisons']) * 100

                await websocket.send_json(progress_data)
                
                # Break if analysis is completed or failed
                if session.get('status') in ['completed', 'failed']:
                    break
                    
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Clean up connection
        if session_id in websocket_connections:
            del websocket_connections[session_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
