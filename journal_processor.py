
import fitz  # PyMuPDF
import re
import sqlite3
import os
from datetime import datetime

# Directory to save extracted logos
LOGO_DIR = "extracted_logos"
JOURNAL_LOGO_DIR = os.path.join(LOGO_DIR, "journal")
CLIENT_LOGO_DIR = os.path.join(LOGO_DIR, "client")

# Create the logo directories if they don't exist
if not os.path.exists(LOGO_DIR):
    os.makedirs(LOGO_DIR)
if not os.path.exists(JOURNAL_LOGO_DIR):
    os.makedirs(JOURNAL_LOGO_DIR)
if not os.path.exists(CLIENT_LOGO_DIR):
    os.makedirs(CLIENT_LOGO_DIR)

# Initialize SQLite database based on type (word_mark or device_mark)
def init_db(db_type):
    if db_type == "word_mark":
        db_name = "journal_wordmark.db"
    elif db_type == "device_mark":
        db_name = "journal_devicemark.db"
    else:
        raise ValueError("Invalid db_type. Must be 'word_mark' or 'device_mark'.")

    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    
    # Create table with updated schema (removed legal_status, added international_reg_no)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS trademarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            journal_no TEXT,
            journal_date TEXT,
            class TEXT,
            application_number TEXT UNIQUE,
            application_date TEXT,
            company_name TEXT,
            address TEXT,
            entity_type TEXT,
            address_for_service TEXT,
            usage_details TEXT,
            location_of_use TEXT,
            goods_services TEXT,
            additional_notes TEXT,
            logo_path TEXT,
            logo_placeholder TEXT,
            word_mark TEXT,
            source_file TEXT,
            proprietor_name TEXT,
            international_reg_no TEXT
        )
    ''')
    
    # Check if columns exist, if not add them
    cursor.execute("PRAGMA table_info(trademarks)")
    columns = [column[1] for column in cursor.fetchall()]
    
    if 'word_mark' not in columns:
        print(f"DEBUG: Adding word_mark column to existing table in {db_name}...")
        cursor.execute("ALTER TABLE trademarks ADD COLUMN word_mark TEXT")
        print(f"DEBUG: word_mark column added successfully to {db_name}.")
    
    if 'international_reg_no' not in columns:
        print(f"DEBUG: Adding international_reg_no column to existing table in {db_name}...")
        cursor.execute("ALTER TABLE trademarks ADD COLUMN international_reg_no TEXT")
        print(f"DEBUG: international_reg_no column added successfully to {db_name}.")
    
    conn.commit()
    print(f"DEBUG: Initialized database {db_name} for {db_type} data.")
    return conn, cursor

# Function to check if application already exists in database
def application_exists_in_db(application_number, db_type):
    """
    Check if application number already exists in the specified database
    """
    if db_type == "word_mark":
        db_name = "word_mark_trademarks.db"
    elif db_type == "device_mark":
        db_name = "device_mark_trademarks.db"
    else:
        return False
    
    # Check if database file exists
    if not os.path.exists(db_name):
        return False
    
    try:
        conn = sqlite3.connect(db_name)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM trademarks WHERE application_number = ?", (application_number,))
        count = cursor.fetchone()[0]
        conn.close()
        return count > 0
    except sqlite3.Error as e:
        print(f"DEBUG: Error checking for duplicate in {db_name}: {e}")
        return False

# Function to check if application exists in any database
def application_exists_anywhere(application_number):
    """
    Check if application number exists in either word_mark or device_mark database
    """
    return (application_exists_in_db(application_number, "word_mark") or 
            application_exists_in_db(application_number, "device_mark"))

# Function to dynamically find the starting page of trademark data in journal PDF
def find_trademark_start_page(doc):
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").upper()
        
        if "APPLICATIONS ADVERTISED BEFORE REGISTRATION" in text:
            print(f"DEBUG: Found transition header on page {page_num}. Starting extraction from page {page_num + 1}.")
            return page_num + 1
        
        if re.search(r"CLASS \d+", text):
            lines = text.split("\n")
            for i, line in enumerate(lines):
                if re.search(r"CLASS \d+", line) and i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if re.match(r"\d+\s+\d{2}/\d{2}/\d{4}", next_line):
                        print(f"DEBUG: Found Class pattern with structured entry on page {page_num}. Starting extraction from this page.")
                        return page_num
    
    print("DEBUG: No clear starting page found. Starting from page 0.")
    return 0

# Function to extract images (logos) from a page and save them
def extract_logo_from_page(page, application_number, page_num, is_journal):
    # Check if logo already exists
    logo_subdir = JOURNAL_LOGO_DIR if is_journal else CLIENT_LOGO_DIR
    logo_filename = f"{application_number}_page_{page_num}_img_0.png"
    logo_path = os.path.join(logo_subdir, logo_filename)
    
    if os.path.exists(logo_path):
        print(f"DEBUG: Logo already exists for application {application_number}. Skipping extraction.")
        return logo_path
    
    images = page.get_images(full=True)
    if not images:
        print(f"DEBUG: No images found for application {application_number} on page {page_num}.")
        return None
    
    doc = page.parent
    for img_index, img in enumerate(images):
        xref = img[0]
        base_image = doc.extract_image(xref)
        image_bytes = base_image["image"]
        
        # Create filename with img_index
        logo_filename = f"{application_number}_page_{page_num}_img_{img_index}.png"
        logo_path = os.path.join(logo_subdir, logo_filename)
        
        # Check if this specific logo file already exists
        if os.path.exists(logo_path):
            print(f"DEBUG: Logo file {logo_path} already exists. Skipping extraction.")
            return logo_path
        
        with open(logo_path, "wb") as img_file:
            img_file.write(image_bytes)
        
        print(f"DEBUG: Extracted logo for application {application_number} on page {page_num}. Saved to {logo_path}.")
        return logo_path
    return None

# Function to extract word mark from lines between journal header and application number
def extract_word_mark(lines, journal_line_idx):
    """
    Extract word mark that appears between journal header and application number
    """
    word_mark_lines = []
    
    # Start from the line after journal header
    for i in range(journal_line_idx + 1, len(lines)):
        line = lines[i].strip()
        
        # Skip empty lines
        if not line:
            continue
            
        # Stop when we hit application number pattern
        if re.match(r"^\d+\s+\d{2}/\d{2}/\d{4}", line):
            break
            
        # Stop when we hit another journal header
        if re.match(r"Trade Marks Journal No:", line):
            break
            
        # Skip priority claimed lines
        if re.match(r"Priority claimed from", line, re.I):
            continue
            
        # Stop when we hit obvious company details patterns
        if re.search(r"Individual|Company|Private Limited|Address for service", line, re.I):
            break
            
        # This line is likely part of the word mark
        word_mark_lines.append(line)
    
    if word_mark_lines:
        word_mark = " ".join(word_mark_lines).strip()
        # Clean up the word mark - remove excessive whitespace
        word_mark = re.sub(r'\s+', ' ', word_mark)
        print(f"DEBUG: Extracted word mark: '{word_mark}'")
        return word_mark
    
    return None

# Function to extract placeholder text where a logo might be absent
def extract_logo_placeholder(text, lines, start_idx):
    placeholder = ""
    for i in range(start_idx, min(start_idx + 5, len(lines))):
        if i >= len(lines):
            break
        line = lines[i].strip()
        line_upper = line.upper()
        
        if any(phrase in line_upper for phrase in ["NO LOGO", "DEVICE NOT PRESENT", "TEXT MARK", "NO DEVICE", "LOGO NOT PROVIDED"]):
            placeholder = line
            break
    print(f"DEBUG: Extracted logo placeholder: {placeholder if placeholder else 'None'}")
    return placeholder if placeholder else None

# Function to extract proprietor name from company name
def extract_proprietor_name(company_name):
    if not company_name:
        return None
        
    trading_as_match = re.match(r"(.+?)\s+TRADING AS\s+.+", company_name, re.I)
    if trading_as_match:
        proprietor = trading_as_match.group(1).strip()
        print(f"DEBUG: Extracted proprietor from 'TRADING AS': {proprietor}")
        return proprietor
    
    if " AND " in company_name.upper():
        proprietors = [name.strip() for name in company_name.split(" AND ")]
        proprietor_str = ", ".join(proprietors)
        print(f"DEBUG: Extracted multiple proprietors: {proprietor_str}")
        return proprietor_str
    
    print(f"DEBUG: Using company_name as proprietor: {company_name}")
    return company_name

# Function to extract international registration number
def extract_international_reg_no(line):
    """
    Extract international registration number from format [International Registration No. : 1834676]
    """
    match = re.search(r"\[International Registration No\.\s*:\s*(\d+)\]", line, re.I)
    if match:
        return match.group(1)
    return None

# Function to find entity type and extract address properly
def extract_entity_type_and_address(lines, start_idx, is_international=False):
    """
    Extract entity_type as the line right above 'Address for service in India/Attorney address:'
    and address as all lines from start_idx until entity_type (excluding entity_type)
    For international applications, extract only the next line after company_name as address
    """
    entity_type = None
    address_lines = []
    
    if is_international:
        # For international applications, only extract the next line as address
        if start_idx < len(lines):
            address = lines[start_idx].strip()
            print(f"DEBUG: Extracted address for international application: '{address}'")
            return None, address  # entity_type is None for international
    
    service_address_idx = None
    
    # Find the index of "Address for service in India/Attorney address:"
    for i in range(start_idx, len(lines)):
        line = lines[i].strip()
        if re.match(r"Address for service", line, re.I):
            service_address_idx = i
            break
    
    # If found, extract entity_type as the line right above it
    if service_address_idx and service_address_idx > 0:
        entity_type = lines[service_address_idx - 1].strip()
        print(f"DEBUG: Found entity_type: '{entity_type}' at line {service_address_idx - 1}")
        
        # Extract address lines from start_idx until entity_type line (excluding entity_type)
        for i in range(start_idx, service_address_idx - 1):
            line = lines[i].strip()
            if line:
                address_lines.append(line)
    else:
        # Fallback: extract address until we hit entity type indicators
        for i in range(start_idx, len(lines)):
            line = lines[i].strip()
            
            # Check for entity type indicators
            if re.search(r"Individual|Company|Private Limited|Public Company|Partnership|Body Incorporate|Natural Person|Artificial Person|Director|Proprietorship|LLP|LIMITED LIABILITY PARTNERSHIP|PROPRIETOR", line, re.I):
                entity_type = line
                print(f"DEBUG: Found entity_type (fallback): '{entity_type}'")
                break
            elif re.match(r"Address for service", line, re.I):
                break
            elif re.match(r"Trade Marks Journal No:", line):
                break
            elif line:
                address_lines.append(line)
    
    address = " ".join(address_lines).strip()
    print(f"DEBUG: Extracted address: '{address}'")
    
    return entity_type, address

# Function to extract goods and services that may span multiple pages
def extract_goods_services_multi_page(doc, start_page, start_line_idx, lines):
    """
    Extract goods and services that may continue to next pages
    """
    goods_services_lines = []
    
    # First, get content from current page starting from start_line_idx
    for i in range(start_line_idx, len(lines)):
        line = lines[i].strip()
        if re.match(r"Trade Marks Journal No:", line):
            break
        if line:
            goods_services_lines.append(line)
    
    # Continue to next pages if needed
    current_page = start_page + 1
    while current_page < len(doc):
        page = doc[current_page]
        text = page.get_text("text")
        page_lines = text.split("\n")
        
        # Check if this page starts with a new journal entry
        if any(re.match(r"Trade Marks Journal No:", line.strip()) for line in page_lines[:5]):
            break
            
        # Add lines from this page until we hit a new journal entry
        for line in page_lines:
            line = line.strip()
            if re.match(r"Trade Marks Journal No:", line):
                return " ".join(goods_services_lines).strip()
            if line:
                goods_services_lines.append(line)
        
        current_page += 1
    
    return " ".join(goods_services_lines).strip()

# Function to check if page has required journal header format
def has_valid_journal_header(text):
    """
    Check if page has Trade Marks Journal No: , date, and class at the beginning
    """
    lines = text.split("\n")[:10]  # Check first 10 lines
    for line in lines:
        if re.match(r"Trade Marks Journal No:\s*\d+\s*,\s*\d{2}/\d{2}/\d{4}\s+Class\s+\d+", line.strip()):
            return True
    return False

# Function to determine which database to use and insert data
def insert_trademark_data(trademark_data):
    """
    Insert trademark data into appropriate database based on word_mark value
    If word_mark is None, insert into device_mark.db, otherwise insert into word_mark.db
    Also checks for duplicates before inserting
    """
    application_number = trademark_data['application_number']
    
    # Check if application already exists in any database
    if application_exists_anywhere(application_number):
        print(f"DEBUG: Application {application_number} already exists in database. Skipping insertion.")
        return
    
    # Determine which database to use
    if trademark_data['word_mark'] is None:
        db_type = "device_mark"
        print(f"DEBUG: Inserting application {application_number} into device_mark database")
    else:
        db_type = "word_mark"
        print(f"DEBUG: Inserting application {application_number} into word_mark database")
    
    # Initialize the appropriate database
    conn, cursor = init_db(db_type)
    
    try:
        # Insert data into database
        cursor.execute('''
            INSERT INTO trademarks (
                journal_no, journal_date, class, application_number, application_date,
                company_name, address, entity_type, address_for_service,
                usage_details, location_of_use, goods_services, additional_notes,
                logo_path, logo_placeholder, word_mark, source_file, proprietor_name,
                international_reg_no
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            trademark_data['journal_no'], trademark_data['journal_date'], trademark_data['class'], 
            trademark_data['application_number'], trademark_data['application_date'],
            trademark_data['company_name'], trademark_data['address'], trademark_data['entity_type'], 
            trademark_data['address_for_service'], trademark_data['usage_details'], 
            trademark_data['location_of_use'], trademark_data['goods_services'], 
            trademark_data['additional_notes'], trademark_data['logo_path'], 
            trademark_data['logo_placeholder'], trademark_data['word_mark'], 
            trademark_data['source_file'], trademark_data['proprietor_name'],
            trademark_data['international_reg_no']
        ))
        
        conn.commit()
        print(f"DEBUG: Successfully inserted application {application_number} into {db_type} database.")
        
    except sqlite3.IntegrityError as e:
        print(f"DEBUG: Duplicate application {application_number} detected. Skipping insertion. Error: {e}")
    except sqlite3.Error as e:
        print(f"DEBUG: Database error inserting application {application_number}: {e}")
    finally:
        conn.close()

# Function to extract data from a PDF (journal or client)
def extract_data_from_pdf(pdf_path, is_journal=True):
    print(f"DEBUG: Processing started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    doc = fitz.open(pdf_path)
    start_page = find_trademark_start_page(doc) if is_journal else 0
    print(f"DEBUG: Starting extraction from page {start_page} for {pdf_path}.")
    
    current_class = None
    journal_no = None
    journal_date = None
    processed_applications = set()  # Track processed applications in this session
    
    for page_num in range(start_page, len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        
        # Check if page has valid journal header format
        if not has_valid_journal_header(text):
            print(f"DEBUG: Skipping page {page_num} - no valid journal header format")
            continue
            
        print(f"DEBUG: Processing page {page_num}")
        lines = text.split("\n")
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Look for journal header with class
            journal_match = re.match(r"Trade Marks Journal No:\s*(\d+)\s*,\s*(\d{2}/\d{2}/\d{4})\s*Class\s*(\d+)", line)
            if journal_match:
                journal_no, journal_date, current_class = journal_match.groups()
                print(f"DEBUG: Extracted journal_no: {journal_no}, journal_date: {journal_date}, class: {current_class}")
                
                # Extract word mark after journal header (skip priority claimed lines)
                word_mark = extract_word_mark(lines, i)
                
                # Look for application number after word mark
                j = i + 1
                application_number = None
                application_date = None
                
                while j < len(lines):
                    next_line = lines[j].strip()
                    app_match = re.match(r"(\d+)\s+(\d{2}/\d{2}/\d{4})", next_line)
                    if app_match:
                        application_number, application_date = app_match.groups()
                        print(f"DEBUG: Found application {application_number}, date: {application_date}")
                        break
                    j += 1
                
                if not application_number:
                    print("DEBUG: No application number found for this journal entry")
                    i += 1
                    continue
                
                # Check if we've already processed this application in this session
                if application_number in processed_applications:
                    print(f"DEBUG: Application {application_number} already processed in this session. Skipping.")
                    i = j + 1
                    continue
                
                # Check if application already exists in database
                if application_exists_anywhere(application_number):
                    print(f"DEBUG: Application {application_number} already exists in database. Skipping.")
                    processed_applications.add(application_number)
                    i = j + 1
                    continue
                
                # Add to processed set
                processed_applications.add(application_number)
                
                # Extract proprietor name and international registration number
                k = j + 1
                proprietor_name = ""
                international_reg_no = None
                
                # Check for international registration number first
                if k < len(lines):
                    int_reg_line = lines[k].strip()
                    international_reg_no = extract_international_reg_no(int_reg_line)
                    if international_reg_no:
                        print(f"DEBUG: Found international registration: {international_reg_no}")
                        k += 1  # Move to next line for proprietor name
                
                # Get proprietor name (next line after application or international reg)
                if k < len(lines):
                    proprietor_name = lines[k].strip()
                    print(f"DEBUG: Extracted proprietor_name: {proprietor_name}")
                    k += 1
                
                # Extract entity_type and address using the improved function
                # Pass is_international flag to handle international applications differently
                entity_type, address = extract_entity_type_and_address(lines, k, is_international=bool(international_reg_no))
                
                # For international applications, set entity_type to None
                if international_reg_no:
                    entity_type = None
                    print(f"DEBUG: Set entity_type to None for international application")
                
                company_name = proprietor_name  # Use proprietor name as company name
                
                # Find where address extraction ended and continue from there
                service_address_start = None
                for idx in range(k, len(lines)):
                    if re.match(r"Address for service", lines[idx].strip(), re.I):
                        service_address_start = idx
                        break
                
                if service_address_start:
                    k = service_address_start
                elif international_reg_no:
                    # For international applications, move k to after the single address line
                    k += 1
                
                # Extract address for service
                address_for_service = ""
                while k < len(lines):
                    service_line = lines[k].strip()
                    if re.match(r"Address for service", service_line, re.I):
                        k += 1
                        service_lines = []
                        while k < len(lines):
                            sub_line = lines[k].strip()
                            if (re.match(r"Used Since|Proposed to be Used", sub_line, re.I) or 
                                re.match(r"Trade Marks Journal No:", sub_line) or
                                re.match(r"\d+\s+\d{2}/\d{2}/\d{4}", sub_line)):
                                break
                            if sub_line:
                                service_lines.append(sub_line)
                            k += 1
                        address_for_service = " ".join(service_lines).strip()
                        break
                    if (re.match(r"Used Since|Proposed to be Used", service_line, re.I) or 
                        re.match(r"Trade Marks Journal No:", service_line)):
                        break
                    k += 1
                
                print(f"DEBUG: Extracted address_for_service: {address_for_service}")
                
                # Extract usage details
                usage_details = ""
                while k < len(lines):
                    usage_line = lines[k].strip()
                    if re.match(r"Used Since|Proposed to be Used", usage_line, re.I):
                        usage_details = usage_line
                        k += 1
                        break
                    if re.match(r"Trade Marks Journal No:", usage_line):
                        break
                    k += 1
                
                print(f"DEBUG: Extracted usage_details: {usage_details}")
                
                # Extract location of use
                location_of_use = ""
                if k < len(lines):
                    location_line = lines[k].strip()
                    if (re.match(r"^[A-Z\s]+$", location_line) and 
                        len(location_line.split()) <= 3 and
                        not re.match(r"Trade Marks Journal No:", location_line)):
                        location_of_use = location_line
                        k += 1
                
                print(f"DEBUG: Extracted location_of_use: {location_of_use}")
                
                # Extract goods and services (may span multiple pages)
                goods_services = extract_goods_services_multi_page(doc, page_num, k, lines)
                print(f"DEBUG: Extracted goods_services: {goods_services[:100]}...")
                
                # Move k to end of goods_services section
                while k < len(lines):
                    goods_line = lines[k].strip()
                    if (re.match(r"Trade Marks Journal No:", goods_line) or
                        any(phrase in goods_line.upper() for phrase in ["REGISTRATION OF THIS TRADE MARK", "NO EXCLUSIVE RIGHT", "THIS IS CONDITION"])):
                        break
                    k += 1
                
                # Extract additional notes
                additional_notes_lines = []
                while k < len(lines):
                    notes_line = lines[k].strip()
                    if re.match(r"Trade Marks Journal No:", notes_line):
                        break
                    if notes_line:
                        additional_notes_lines.append(notes_line)
                    k += 1
                
                additional_notes = " ".join(additional_notes_lines).strip()
                print(f"DEBUG: Extracted additional_notes: {additional_notes[:100]}...")
                
                # Extract logo (with duplicate check)
                logo_path = extract_logo_from_page(page, application_number, page_num, is_journal)
                logo_placeholder = None
                if not logo_path and not word_mark:
                    logo_placeholder = extract_logo_placeholder(text, lines, 0)
                
                # If there's an image, set word_mark to None
                if logo_path:
                    word_mark = None
                
                # Extract final proprietor name
                final_proprietor_name = extract_proprietor_name(company_name)
                
                # Prepare trademark data dictionary
                trademark_data = {
                    'journal_no': journal_no,
                    'journal_date': journal_date,
                    'class': current_class,
                    'application_number': application_number,
                    'application_date': application_date,
                    'company_name': company_name,
                    'address': address,
                    'entity_type': entity_type,
                    'address_for_service': address_for_service,
                    'usage_details': usage_details,
                    'location_of_use': location_of_use,
                    'goods_services': goods_services,
                    'additional_notes': additional_notes,
                    'logo_path': logo_path,
                    'logo_placeholder': logo_placeholder,
                    'word_mark': word_mark,
                    'source_file': pdf_path,
                    'proprietor_name': final_proprietor_name,
                    'international_reg_no': international_reg_no
                }
                
                # Insert data into appropriate database (with duplicate check)
                insert_trademark_data(trademark_data)
                
                # Move to next iteration
                i = k
                continue
            
            i += 1
    
    doc.close()
    print(f"DEBUG: Processing completed at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"DEBUG: Processed {len(processed_applications)} unique applications in this session.")

# Main function to process PDFs
def process_trademarks(journal_pdf_path):
    print(f"Processing journal PDF: {journal_pdf_path}")
    extract_data_from_pdf(journal_pdf_path, is_journal=True)

if __name__ == "__main__":
    journal_pdf = "/home/rudra-panda/Desktop/Intern/journal_processing/journals/ViewJournal (2).pdf"
    process_trademarks(journal_pdf)

