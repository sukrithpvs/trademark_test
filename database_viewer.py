import sqlite3
import os
import sys
from datetime import datetime
import argparse

class TrademarkDatabaseViewer:
    def __init__(self, db_path=None):
        self.database_path = db_path
        self.database_paths = []
        if db_path:
            self.database_paths = [db_path]

    def get_database_path(self):
        """Get database path from user input"""
        while True:
            print("\n📁 DATABASE PATH SELECTION")
            print("-" * 40)
            
            db_path = input("Enter the full path to your database file: ").strip()
            
            if not db_path:
                print("❌ Please enter a valid path!")
                continue
            
            # Expand user path (handles ~ for home directory)
            db_path = os.path.expanduser(db_path)
            
            # Check if file exists
            if not os.path.exists(db_path):
                print(f"❌ Database file not found: {db_path}")
                retry = input("Do you want to try again? (y/n): ").lower().strip()
                if retry != 'y':
                    return None
                continue
            
            # Check if it's a valid SQLite database
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                tables = cursor.fetchall()
                conn.close()
                
                print(f"✅ Valid database found: {db_path}")
                print(f"📊 Found {len(tables)} tables")
                
                self.database_path = db_path
                self.database_paths = [db_path]
                return db_path
                
            except sqlite3.Error as e:
                print(f"❌ Invalid SQLite database: {e}")
                retry = input("Do you want to try again? (y/n): ").lower().strip()
                if retry != 'y':
                    return None

    def get_table_info(self, db_path):
        """Get detailed information about tables in the database"""
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            # Get all tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [table[0] for table in cursor.fetchall()]
            
            table_info = {}
            for table in tables:
                # Get column info
                cursor.execute(f"PRAGMA table_info({table});")
                columns = cursor.fetchall()
                
                # Get row count
                cursor.execute(f"SELECT COUNT(*) FROM {table};")
                row_count = cursor.fetchone()[0]
                
                table_info[table] = {
                    'columns': columns,
                    'row_count': row_count
                }
            
            return table_info
            
        except Exception as e:
            print(f"Error getting table info: {e}")
            return {}
        finally:
            conn.close()

    def display_database_summary(self, db_path):
        """Display a summary of the database"""
        if not os.path.exists(db_path):
            print(f"❌ Database file not found: {db_path}")
            return False
        
        print(f"\n📊 DATABASE SUMMARY: {db_path}")
        print("=" * 80)
        
        # File info
        file_size = os.path.getsize(db_path) / (1024 * 1024)  # MB
        mod_time = datetime.fromtimestamp(os.path.getmtime(db_path))
        
        print(f"📁 File size: {file_size:.2f} MB")
        print(f"📅 Last modified: {mod_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📂 Full path: {os.path.abspath(db_path)}")
        
        # Table info
        table_info = self.get_table_info(db_path)
        
        if not table_info:
            print("❌ No tables found or error accessing database")
            return False
        
        print(f"\n📋 Tables found: {len(table_info)}")
        
        for table_name, info in table_info.items():
            print(f"\n  📄 Table: {table_name}")
            print(f"     Rows: {info['row_count']:,}")
            print(f"     Columns: {len(info['columns'])}")
            
            # Show column details
            print("     Column Details:")
            for col in info['columns']:
                col_id, col_name, col_type, not_null, default, primary_key = col
                pk_marker = " (PRIMARY KEY)" if primary_key else ""
                nn_marker = " NOT NULL" if not_null else ""
                print(f"       - {col_name}: {col_type}{pk_marker}{nn_marker}")
        
        return True

    def display_table_data(self, db_path, table_name, limit=10, show_all_columns=False):
        """Display data from a specific table"""
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            # Get column names
            cursor.execute(f"PRAGMA table_info({table_name});")
            column_info = cursor.fetchall()
            column_names = [col[1] for col in column_info]
            
            if not show_all_columns:
                # Show only important columns for readability
                important_columns = ['id', 'application_number', 'class', 'application_date', 
                                   'proprietor_name', 'company_name', 'word_mark', 'logo_path',
                                   'journal_no', 'journal_date', 'status', 'registration_number',
                                   'API_appno', 'API_status', 'API_propName', 'API_class']
                
                display_columns = [col for col in important_columns if col in column_names]
                if not display_columns:
                    display_columns = column_names[:6]  # Show first 6 columns if no match
            else:
                display_columns = column_names
            
            # Create SELECT query
            columns_str = ", ".join(display_columns)
            cursor.execute(f"SELECT {columns_str} FROM {table_name} LIMIT {limit};")
            rows = cursor.fetchall()
            
            if not rows:
                print(f"❌ No data found in table '{table_name}'")
                return
            
            print(f"\n📋 DATA FROM TABLE: {table_name} (First {len(rows)} rows)")
            print("-" * 120)
            
            # Print headers
            header = " | ".join(f"{col[:15]:15}" for col in display_columns)
            print(header)
            print("-" * len(header))
            
            # Print rows
            for i, row in enumerate(rows, 1):
                row_str = " | ".join(f"{str(item)[:15]:15}" if item else f"{'':15}" for item in row)
                print(f"{row_str}")
            
            print(f"\nShowing {len(rows)} of {self.get_total_rows(db_path, table_name)} total rows")
            
        except Exception as e:
            print(f"❌ Error displaying table data: {e}")
        finally:
            conn.close()

    def get_total_rows(self, db_path, table_name):
        """Get total number of rows in a table"""
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
            return cursor.fetchone()[0]
        except:
            return 0
        finally:
            conn.close()

    def search_database(self, db_path, search_term, table_name=None):
        """Search for specific terms in the database"""
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            # Get all tables if not specified
            if not table_name:
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
                tables = [table[0] for table in cursor.fetchall()]
            else:
                tables = [table_name]
            
            print(f"\n🔍 SEARCH RESULTS for '{search_term}':")
            print("=" * 80)
            
            total_matches = 0
            
            for table in tables:
                # Get column names
                cursor.execute(f"PRAGMA table_info({table});")
                columns = [col[1] for col in cursor.fetchall()]
                
                # Search in text columns
                text_columns = []
                for col in columns:
                    if any(keyword in col.lower() for keyword in ['name', 'mark', 'address', 'service', 'good', 'api_']):
                        text_columns.append(col)
                
                if not text_columns:
                    continue
                
                # Build search query
                where_conditions = []
                for col in text_columns:
                    where_conditions.append(f"{col} LIKE ?")
                
                where_clause = " OR ".join(where_conditions)
                search_params = [f"%{search_term}%" for _ in text_columns]
                
                query = f"SELECT * FROM {table} WHERE {where_clause}"
                cursor.execute(query, search_params)
                results = cursor.fetchall()
                
                if results:
                    print(f"\n📄 Found {len(results)} matches in table '{table}':")
                    
                    # Show first few results
                    for i, row in enumerate(results[:5], 1):
                        print(f"  {i}. ", end="")
                        # Show relevant fields
                        for j, col in enumerate(columns):
                            if col in ['application_number', 'company_name', 'word_mark', 'proprietor_name', 'API_appno', 'API_propName']:
                                if j < len(row) and row[j]:
                                    print(f"{col}: {row[j]}, ", end="")
                        print()
                    
                    if len(results) > 5:
                        print(f"  ... and {len(results) - 5} more matches")
                    
                    total_matches += len(results)
            
            print(f"\n📊 Total matches found: {total_matches}")
            
        except Exception as e:
            print(f"❌ Error searching database: {e}")
        finally:
            conn.close()

    def export_to_csv(self, db_path, table_name, output_file=None):
        """Export table data to CSV"""
        import csv
        
        if not output_file:
            output_file = f"{table_name}_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute(f"SELECT * FROM {table_name};")
            rows = cursor.fetchall()
            
            # Get column names
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = [col[1] for col in cursor.fetchall()]
            
            with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow(columns)  # Header
                writer.writerows(rows)    # Data
            
            print(f"✅ Exported {len(rows)} rows to: {output_file}")
            
        except Exception as e:
            print(f"❌ Error exporting to CSV: {e}")
        finally:
            conn.close()

    def interactive_mode(self):
        """Interactive mode for database exploration"""
        # Get database path if not provided
        if not self.database_path:
            db_path = self.get_database_path()
            if not db_path:
                print("❌ No database selected. Exiting...")
                return
        else:
            db_path = self.database_path
        
        while True:
            print("\n" + "="*60)
            print("🗄️  DATABASE VIEWER")
            print("="*60)
            print(f"📁 Current database: {os.path.basename(db_path)}")
            print(f"📂 Full path: {db_path}")
            
            print("\n🛠️  Options:")
            print("  s) Show database summary")
            print("  d) Display table data")
            print("  f) Search database")
            print("  e) Export table to CSV")
            print("  c) Change database")
            print("  q) Quit")
            
            choice = input("\nEnter your choice: ").lower().strip()
            
            if choice == 'q':
                print("👋 Goodbye!")
                break
            elif choice == 'c':
                new_path = self.get_database_path()
                if new_path:
                    db_path = new_path
                continue
            elif choice == 's':
                self.display_database_summary(db_path)
            elif choice == 'd':
                self._handle_display_data(db_path)
            elif choice == 'f':
                self._handle_search(db_path)
            elif choice == 'e':
                self._handle_export(db_path)
            else:
                print("❌ Invalid choice!")

    def _handle_display_data(self, db_path):
        """Handle data display"""
        table_info = self.get_table_info(db_path)
        if not table_info:
            return
        
        print("Select table:")
        tables = list(table_info.keys())
        for i, table in enumerate(tables, 1):
            print(f"  {i}. {table} ({table_info[table]['row_count']} rows)")
        
        try:
            choice = int(input("Enter table number: ")) - 1
            if 0 <= choice < len(tables):
                table_name = tables[choice]
                limit = input("Number of rows to show (default 10): ").strip()
                limit = int(limit) if limit.isdigit() else 10
                
                show_all = input("Show all columns? (y/n, default n): ").lower().strip() == 'y'
                
                self.display_table_data(db_path, table_name, limit, show_all)
            else:
                print("❌ Invalid selection!")
        except ValueError:
            print("❌ Please enter a valid number!")

    def _handle_search(self, db_path):
        """Handle search functionality"""
        search_term = input("Enter search term: ").strip()
        if search_term:
            self.search_database(db_path, search_term)

    def _handle_export(self, db_path):
        """Handle CSV export"""
        table_info = self.get_table_info(db_path)
        if not table_info:
            return
        
        print("Select table to export:")
        tables = list(table_info.keys())
        for i, table in enumerate(tables, 1):
            print(f"  {i}. {table} ({table_info[table]['row_count']} rows)")
        
        try:
            choice = int(input("Enter table number: ")) - 1
            if 0 <= choice < len(tables):
                table_name = tables[choice]
                output_file = input("Output filename (press Enter for auto): ").strip()
                output_file = output_file if output_file else None
                
                self.export_to_csv(db_path, table_name, output_file)
            else:
                print("❌ Invalid selection!")
        except ValueError:
            print("❌ Please enter a valid number!")

def main():
    """Main function with command line interface"""
    parser = argparse.ArgumentParser(description='Database Viewer with Custom Path Input')
    parser.add_argument('--db', help='Database file path')
    parser.add_argument('--table', help='Table name to display')
    parser.add_argument('--limit', type=int, default=10, help='Number of rows to display')
    parser.add_argument('--search', help='Search term')
    parser.add_argument('--export', help='Export table to CSV')
    parser.add_argument('--summary', action='store_true', help='Show database summary')
    parser.add_argument('--interactive', '-i', action='store_true', help='Interactive mode')
    
    args = parser.parse_args()
    
    # Initialize viewer with provided database path
    viewer = TrademarkDatabaseViewer(args.db)
    
    if args.interactive or len(sys.argv) == 1:
        # Interactive mode
        viewer.interactive_mode()
    else:
        # Command line mode
        db_path = args.db
        if not db_path:
            print("❌ Please provide database path with --db argument")
            return
        
        if not os.path.exists(db_path):
            print(f"❌ Database file not found: {db_path}")
            return
        
        if args.summary:
            viewer.display_database_summary(db_path)
        elif args.search:
            viewer.search_database(db_path, args.search, args.table)
        elif args.export and args.table:
            viewer.export_to_csv(db_path, args.table, args.export)
        elif args.table:
            viewer.display_table_data(db_path, args.table, args.limit)
        else:
            viewer.display_database_summary(db_path)

if __name__ == "__main__":
    main()
