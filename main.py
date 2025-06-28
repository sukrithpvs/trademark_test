import os
import uuid
import asyncio
import json
import math
import time
from datetime import datetime
from typing import Optional, List, Dict, Any
import sqlite3
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, WebSocket, WebSocketDisconnect, BackgroundTasks, Query
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
        
        # Sort by highest score first
        combined_results.sort(key=lambda x: (
            x.get('risk_level') == 'No Risk',
            x.get('risk_level') == 'Low',
            x.get('risk_level') == 'Medium',
            -(x.get('final_score', 0))
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

# SINGLE ANALYSIS START ENDPOINT
@app.post("/api/analysis/start")
async def start_analysis(
    background_tasks: BackgroundTasks,
    journal_pdf: UploadFile = File(...),
    analysis_type: str = Form(...),  # Make this required
    client_device_limit: int = Form(20),
    client_word_limit: int = Form(20),
    visual_weight: float = Form(0.5),
    text_weight: float = Form(0.5)
):
    """Single endpoint to start any type of analysis"""
    
    # Enhanced logging
    print(f"🔍 Analysis Request Received:")
    print(f"  📄 PDF: {journal_pdf.filename} ({getattr(journal_pdf, 'size', 'unknown')} bytes)")
    print(f"  🔧 Analysis Type: '{analysis_type}'")
    print(f"  📊 Device Limit: {client_device_limit}")
    print(f"  📝 Word Limit: {client_word_limit}")
    print(f"  👁️ Visual Weight: {visual_weight}")
    print(f"  📝 Text Weight: {text_weight}")
    
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

# ANALYSIS STATUS ENDPOINT
@app.get("/api/analysis/{session_id}/status")
async def get_analysis_status(session_id: str):
    """Get analysis status with progress information"""
    session = db_manager.get_analysis_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    progress_percent = 0
    if session.get('total_comparisons', 0) > 0:
        progress_percent = (session.get('processed_comparisons', 0) / session['total_comparisons']) * 100

    return AnalysisStatus(
        session_id=session_id,
        status=session['status'],
        progress_percent=progress_percent,
        current_step=f"Processed {session.get('processed_comparisons', 0)} of {session.get('total_comparisons', 0)} comparisons",
        total_comparisons=session.get('total_comparisons', 0),
        processed_comparisons=session.get('processed_comparisons', 0),
        high_risk_found=session.get('high_risk_found', 0),
        medium_risk_found=session.get('medium_risk_found', 0),
        no_risk_found=session.get('no_risk_found', 0),
        processing_time=session.get('processing_time', 0)
    )

# ANALYSIS RESULTS ENDPOINT
@app.get("/api/analysis/{session_id}/results")
async def get_analysis_results(
    session_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    exclude_no_risk: bool = Query(True),
    comparison_type: Optional[str] = Query(None)
):
    """Get analysis results with pagination and filtering"""
    session = db_manager.get_analysis_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Analysis session not found")

    if session['status'] != 'completed':
        raise HTTPException(status_code=400, detail="Analysis not completed yet")

    if not session.get('results_json'):
        raise HTTPException(status_code=404, detail="No results found")

    try:
        all_results = json.loads(session['results_json'])
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to parse results")

    # Filter out "No Risk" results if requested
    if exclude_no_risk:
        filtered_results = [r for r in all_results if r.get('risk_level') != 'No Risk']
    else:
        filtered_results = all_results

    # Server-side comparison type filtering
    if comparison_type:
        if comparison_type == 'device':
            filtered_results = [r for r in filtered_results if r.get('comparison_type') == 'device_mark']
        elif comparison_type == 'word':
            filtered_results = [r for r in filtered_results if r.get('comparison_type') == 'word_mark']

    # Sort by highest score first (100%, 90%, 80%, etc.)
    filtered_results.sort(key=lambda x: -(x.get('final_score', 0)))

    # Calculate statistics
    all_device_count = sum(1 for r in filtered_results if r.get('comparison_type') == 'device_mark')
    all_word_count = sum(1 for r in filtered_results if r.get('comparison_type') == 'word_mark')
    high_risk_count = sum(1 for r in filtered_results if r.get('risk_level') == 'High')
    medium_risk_count = sum(1 for r in filtered_results if r.get('risk_level') == 'Medium')
    low_risk_count = sum(1 for r in filtered_results if r.get('risk_level') == 'Low')

    # Apply pagination
    total = len(filtered_results)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_results = filtered_results[start:end]

    # Format results for frontend
    batch_results = []
    for result in paginated_results:
        try:
            client_mark = result.get('client_mark', {})
            journal_mark = result.get('journal_mark', {})

            # Convert image paths to URLs
            if client_mark.get('image_path'):
                client_mark['image_path'] = convert_path_to_url(client_mark['image_path'])
            if journal_mark.get('image_path'):
                journal_mark['image_path'] = convert_path_to_url(journal_mark['image_path'])

            formatted_result = {
                "id": result.get('id', str(uuid.uuid4())),
                "risk_level": result.get('risk_level', 'No Risk'),
                "comparison_type": result.get('comparison_type', 'device_mark'),
                "final_score": float(result.get('final_score', 0)),
                "visual_score": float(result.get('visual_score', 0)),
                "text_score": float(result.get('text_score', 0)),
                "logo_name": journal_mark.get('company_name', f"Result {result.get('id', '')[:8]}"),
                "logo_path": journal_mark.get('image_path', '/placeholder.svg'),
                "text1": result.get('text1', ''),
                "text2": result.get('text2', ''),
                "infringement_detected": result.get('infringement_detected', False),
                "client_mark": {
                    **client_mark,
                    "application_number": client_mark.get('application_number', client_mark.get('app_no', 'N/A')),
                    "business_name": client_mark.get('business_name', client_mark.get('prop_name', 'N/A')),
                    "class": str(client_mark.get('class', 'N/A')),
                    "date_of_app": client_mark.get('date_of_app', 'N/A'),
                    "status": client_mark.get('status', 'N/A'),
                    "class_description": client_mark.get('goods_services', client_mark.get('class_description', 'N/A'))
                },
                "journal_mark": {
                    **journal_mark,
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
            continue

    return AnalysisResult(
        session_id=session_id,
        total_reference_images=session.get('total_comparisons', 0),
        processed_reference_images=session.get('processed_comparisons', 0),
        total_processing_time=session.get('processing_time', 0),
        summary={
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
        batch_results=batch_results,
        pagination={
            "page": page,
            "per_page": per_page,
            "total_pages": math.ceil(total / per_page) if total > 0 else 1,
            "total": total
        }
    )

# DEVICE RESULTS SPECIFIC ENDPOINT
@app.get("/api/analysis/{session_id}/device-results")
async def get_device_results(
    session_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    exclude_no_risk: bool = Query(True)
):
    """Get device mark analysis results only"""
    return await get_analysis_results(session_id, page, per_page, exclude_no_risk, "device")

# WORD RESULTS SPECIFIC ENDPOINT
@app.get("/api/analysis/{session_id}/word-results")
async def get_word_results(
    session_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=100),
    exclude_no_risk: bool = Query(True)
):
    """Get word mark analysis results only"""
    return await get_analysis_results(session_id, page, per_page, exclude_no_risk, "word")

# ANALYSIS SUMMARY ENDPOINT
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
# OTHER EXISTING ENDPOINTS
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
        conn = sqlite3.connect('client_test_devicemark.db')
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM trademark_data WHERE API_imagepath IS NOT NULL AND API_imagepath != ""')
        device_count = cursor.fetchone()[0]
        conn.close()
    
    if os.path.exists('client_test_wordmark.db'):
        conn = sqlite3.connect('client_test_wordmark.db')
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) FROM trademark_data WHERE API_tmAppliedFor IS NOT NULL AND API_tmAppliedFor != ""')
        word_count = cursor.fetchone()[0]
        conn.close()
    
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

@app.get("/api/clients/word-marks")
async def get_client_word_marks():
    """Get all client word marks from database"""
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
            
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        if session_id in websocket_connections:
            del websocket_connections[session_id]
    except Exception as e:
        if session_id in websocket_connections:
            del websocket_connections[session_id]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
