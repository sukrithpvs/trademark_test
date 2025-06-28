
import os
import requests
import base64
from PIL import Image
import json
import hashlib
from tqdm import tqdm
import io
import time
import random
from datetime import datetime
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from concurrent.futures import ThreadPoolExecutor, as_completed

class TextExtractor:
    def __init__(self, cache_dir="text_cache"):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Groq API Configuration
        self.groq_api_key = ""
        self.groq_api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model_name = "meta-llama/llama-4-scout-17b-16e-instruct"
        
        print(f"🤖 Using Groq API with model: {self.model_name}")
        print(f"📁 Cache directory: {self.cache_dir}")
        
        # Create session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # ✅ ENHANCED: Cache file setup with better path handling
        self.cache_file = os.path.join(self.cache_dir, "text_cache.json")
        self.text_cache = {}
        
        # ✅ ENHANCED: Load cache with better error handling and validation
        self._load_cache()
        
        # ✅ NEW: Cache performance tracking
        self.cache_hits = 0
        self.cache_misses = 0
        self.total_requests = 0
        
        # Rate limiting
        self.last_request_time = 0
        self.min_request_interval = 0.8  # 800ms for stability
        
        # Batch processing settings
        self.use_batch_processing = False
        self.max_concurrent_requests = 3  # Reduced for stability
        
        print(f"📄 Cache file: {self.cache_file}")
        print(f"📊 Loaded {len(self.text_cache)} cached entries")
        print("✅ Groq-based text extractor initialized successfully!")

    def _load_cache(self):
        """✅ ENHANCED: Load text cache from disk with better validation"""
        try:
            if os.path.exists(self.cache_file):
                # Check file size and permissions
                file_size = os.path.getsize(self.cache_file)
                if file_size == 0:
                    print(f"⚠️ Cache file is empty: {self.cache_file}")
                    self.text_cache = {}
                    return
                
                print(f"📁 Loading cache from: {self.cache_file}")
                print(f"📊 Cache file size: {file_size:,} bytes")
                
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                
                # ✅ ENHANCED: Better cache validation
                if isinstance(cache_data, dict):
                    # Validate each cache entry
                    valid_cache = {}
                    invalid_count = 0
                    
                    for key, value in cache_data.items():
                        if isinstance(key, str) and isinstance(value, str):
                            valid_cache[key] = value
                        else:
                            invalid_count += 1
                    
                    self.text_cache = valid_cache
                    print(f"✅ Successfully loaded {len(self.text_cache)} cached text extractions")
                    
                    if invalid_count > 0:
                        print(f"⚠️ Removed {invalid_count} invalid cache entries")
                    
                    # Show cache statistics
                    if self.text_cache:
                        # Count non-empty extractions
                        non_empty_count = sum(1 for text in self.text_cache.values() if text.strip())
                        empty_count = len(self.text_cache) - non_empty_count
                        print(f"📈 Cache stats: {non_empty_count} with text, {empty_count} empty")
                else:
                    print(f"⚠️ Invalid cache format, starting fresh")
                    self.text_cache = {}
                    
            else:
                print(f"📄 No existing cache file found at: {self.cache_file}")
                print(f"📁 Will create new cache file when needed")
                self.text_cache = {}
                
        except json.JSONDecodeError as e:
            print(f"⚠️ Cache file corrupted (JSON error): {e}")
            print(f"🔄 Creating backup and starting fresh...")
            self._backup_corrupted_cache()
            self.text_cache = {}
        except Exception as e:
            print(f"⚠️ Failed to load text cache: {e}")
            self.text_cache = {}

    def _backup_corrupted_cache(self):
        """✅ NEW: Backup corrupted cache file"""
        try:
            if os.path.exists(self.cache_file):
                backup_file = f"{self.cache_file}.backup_{int(time.time())}"
                os.rename(self.cache_file, backup_file)
                print(f"💾 Corrupted cache backed up to: {backup_file}")
        except Exception as e:
            print(f"⚠️ Failed to backup corrupted cache: {e}")

    def _save_cache(self):
        """✅ ENHANCED: Save text cache to disk with atomic write"""
        try:
            # Ensure directory exists
            os.makedirs(os.path.dirname(self.cache_file), exist_ok=True)
            
            # Atomic write to prevent corruption
            temp_file = f"{self.cache_file}.tmp"
            
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(self.text_cache, f, ensure_ascii=False, indent=2)
            
            # Atomic move
            if os.path.exists(temp_file):
                if os.path.exists(self.cache_file):
                    os.replace(temp_file, self.cache_file)
                else:
                    os.rename(temp_file, self.cache_file)
                    
            print(f"💾 Cache saved: {len(self.text_cache)} entries to {self.cache_file}")
                    
        except Exception as e:
            print(f"⚠️ Failed to save text cache: {e}")
            # Clean up temp file if it exists
            if os.path.exists(f"{self.cache_file}.tmp"):
                try:
                    os.remove(f"{self.cache_file}.tmp")
                except:
                    pass

    def _get_file_hash(self, file_path):
        """✅ OPTIMIZED: Generate consistent hash for cache key with better performance"""
        import hashlib
        
        try:
            # Use consistent path format - normalize and convert to absolute
            abs_path = os.path.abspath(file_path)
            normalized_path = os.path.normpath(abs_path)
            
            # Get file stats
            stat = os.stat(normalized_path)
            file_size = stat.st_size
            # Use integer modification time for consistency
            mod_time = int(stat.st_mtime)
            
            # ✅ OPTIMIZED: Use smaller content sample for faster hashing
            with open(normalized_path, 'rb') as f:
                content_sample = f.read(512)  # Reduced from 1024 to 512 bytes
            
            # Create hash from consistent components
            hash_input = f"{normalized_path}_{file_size}_{mod_time}".encode('utf-8')
            hash_input += content_sample
            
            file_hash = hashlib.md5(hash_input).hexdigest()
            
            return file_hash
            
        except Exception as e:
            print(f"❌ Error generating hash for {file_path}: {e}")
            # Fallback hash using just normalized path
            abs_path = os.path.abspath(file_path)
            normalized_path = os.path.normpath(abs_path)
            return hashlib.md5(normalized_path.encode('utf-8')).hexdigest()

    def _encode_image_to_base64(self, image, quality=85):
        """Convert PIL image to base64 string with compression"""
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG", quality=quality, optimize=True)
        return base64.b64encode(buffered.getvalue()).decode()

    def _rate_limit(self):
        """Implement rate limiting with jitter"""
        current_time = time.time()
        elapsed = current_time - self.last_request_time
        
        # Add jitter to prevent synchronized requests
        min_interval = self.min_request_interval + random.uniform(0, 0.3)
        
        if elapsed < min_interval:
            sleep_time = min_interval - elapsed
            time.sleep(sleep_time)
        
        self.last_request_time = time.time()

    def _is_generic_or_descriptive(self, text):
        """✅ NEW: Check if extracted text contains only generic/descriptive terms"""
        if not text or not text.strip():
            return True
            
        # Common generic/descriptive terms that shouldn't be trademarked
        generic_terms = {
            # Business/Company terms
            'company', 'corporation', 'corp', 'inc', 'incorporated', 'ltd', 'limited', 
            'group', 'enterprise', 'business', 'services', 'solutions', 'systems',
            
            # Descriptive terms
            'best', 'super', 'premium', 'quality', 'fresh', 'new', 'original', 'classic',
            'professional', 'advanced', 'ultimate', 'perfect', 'excellent', 'superior',
            'deluxe', 'luxury', 'standard', 'basic', 'special', 'unique', 'exclusive',
            
            # Industry terms
            'sport', 'sports', 'utility', 'vehicles', 'automotive', 'finance', 'financial',
            'technology', 'tech', 'digital', 'online', 'web', 'internet', 'mobile',
            'software', 'hardware', 'consulting', 'management', 'marketing', 'design',
            'development', 'manufacturing', 'retail', 'wholesale', 'distribution',
            
            # Generic product terms
            'product', 'products', 'goods', 'items', 'merchandise', 'equipment',
            'tools', 'supplies', 'materials', 'parts', 'components', 'accessories',
            
            # Location/Geographic (generic usage)
            'international', 'global', 'worldwide', 'national', 'local', 'regional',
            'domestic', 'foreign', 'overseas', 'continental',
            
            # Time-related
            'daily', 'weekly', 'monthly', 'annual', 'seasonal', 'modern', 'contemporary',
            
            # Size/Scale
            'big', 'large', 'small', 'mini', 'micro', 'macro', 'giant', 'mega',
            
            # Common adjectives
            'good', 'great', 'amazing', 'wonderful', 'fantastic', 'incredible',
            'outstanding', 'remarkable', 'exceptional', 'extraordinary'
        }
        
        # Clean and normalize the text for checking
        words = text.lower().replace(',', ' ').replace('.', ' ').split()
        words = [word.strip() for word in words if word.strip()]
        
        # If all words are generic terms, return True
        if words and all(word in generic_terms for word in words):
            return True
            
        # Check for common generic phrases
        text_clean = ' '.join(words)
        generic_phrases = [
            'sport utility vehicles', 'sports utility vehicles',
            'financial services', 'consulting services', 'professional services',
            'technology solutions', 'business solutions', 'software solutions',
            'quality products', 'premium products', 'best products',
            'online services', 'digital services', 'web services',
            'automotive parts', 'auto parts', 'car parts',
            'home improvement', 'property management', 'real estate',
            'health care', 'medical services', 'dental care'
        ]
        
        if any(phrase in text_clean for phrase in generic_phrases):
            return True
            
        return False

    def _has_brand_name(self, text):
        """✅ NEW: Check if text contains a potential brand name (non-generic term)"""
        if not text or not text.strip():
            return False
            
        # Clean and normalize the text
        words = text.replace(',', ' ').replace('.', ' ').split()
        words = [word.strip() for word in words if word.strip() and len(word) > 1]
        
        if not words:
            return False
            
        # Check if any word could be a brand name (not generic)
        for word in words:
            if not self._is_generic_or_descriptive(word):
                return True
                
        return False

    def clean_extracted_text(self, text):
        """✅ ENHANCED: Clean extracted text with proper trademark format handling"""
        if text is None:
            return ""
        
        text = str(text).strip()
        
        # Handle empty or whitespace-only text
        if not text or text.isspace():
            return ""
        
        # ✅ ANTI-HALLUCINATION: Remove any text that contains reasoning or explanation patterns
        hallucination_patterns = [
            "based on", "reasoning:", "analysis:", "therefore", "however", "given that",
            "the correct response", "following the instructions", "more accurately",
            "the best answer", "considering", "would actually", "it is not here",
            "since there is no", "appears to be", "seems to be", "looks like",
            "commonly associated", "recognizable", "under the guidelines",
            "focusing strictly", "the instructions provided", "would reflect",
            "critical analysis", "human readability test", "focus word identification",
            "transliteration requirement", "output format", "rejection criteria",
            "final analysis result", "**", "1.", "2.", "3.", "4.", "5."
        ]
        
        text_lower = text.lower()
        for pattern in hallucination_patterns:
            if pattern in text_lower:
                # If hallucination detected, extract only the valid format if present
                if text.startswith('{') and '},' in text:
                    # Try to extract just the valid format
                    try:
                        end_index = text.find('},') + 2
                        remaining = text[end_index:].strip()
                        if remaining and not any(p in remaining.lower() for p in hallucination_patterns):
                            text = text[:end_index] + remaining
                            break
                        else:
                            text = text[:end_index].rstrip(',').strip()
                            break
                    except:
                        return ""
                else:
                    return ""
        
        # Handle common "empty" responses
        empty_responses = {
            '""', "''", '""', "''", '""""', "''''", 
            '(no text)', 'no text', 'NO TEXT', 'EMPTY',
            'null', 'None', 'undefined', 'n/a', 'N/A',
            '{}, ', '{},', '{},'
        }
        
        if text.lower() in [resp.lower() for resp in empty_responses]:
            return ""
        
        # Remove common OCR prefixes (more comprehensive)
        prefixes_to_remove = [
            "The text in the image reads:",
            "The text in the image is:",
            "The image contains the text:",
            "I can see the text:",
            "The text shown is:",
            "Text in image:",
            "Image text:",
            "The text visible in the image is:",
            "Looking at the image, the text says:",
            "All visible text from this image:",
            "Extract all text:",
            "The visible text is:",
            "Text found in image:",
            "Based on the image, the text is:",
            "The extracted text is:",
            "IMAGE_1:", "IMAGE_2:", "IMAGE_3:", "IMAGE_4:", "IMAGE_5:",
            "Focus word:",
            "The focus word is:",
        ]
        
        for prefix in prefixes_to_remove:
            if text_lower.startswith(prefix.lower()):
                text = text[len(prefix):].strip()
                break
        
        # Remove quotes if the entire text is wrapped in them (but preserve our format)
        if len(text) >= 2 and not text.startswith('{'):
            if (text.startswith('"') and text.endswith('"')) or \
               (text.startswith("'") and text.endswith("'")):
                text = text[1:-1].strip()
        
        # ✅ NEW: Handle trademark format logic
        if text:
            # If text has readable content, determine the proper format
            if self._has_brand_name(text):
                # Text contains a potential brand name - use existing format logic
                if text.startswith('{') and '},' in text:
                    return text  # Already in correct format
                else:
                    # Need to format it properly - this should be handled by the prompt
                    return text
            else:
                # Text is generic/descriptive only - return with empty focus word
                if text.startswith('{') and '},' in text:
                    # Already formatted, check if focus is empty
                    try:
                        focus_end = text.find('},')
                        focus_word = text[1:focus_end].strip()
                        full_text = text[focus_end + 2:].strip()
                        
                        if focus_word and not self._is_generic_or_descriptive(focus_word):
                            return text  # Valid brand name focus
                        else:
                            return f"{{}}, {full_text}"  # Empty focus for generic text
                    except:
                        return f"{{}}, {text}"
                else:
                    # Plain text that's generic - format with empty focus
                    return f"{{}}, {text}"
        
        return ""

    def extract_text_from_image(self, image_path, max_retries=3):
        """✅ ENHANCED: Extract text from single image with proper trademark format handling"""
        cache_hash = self._get_file_hash(image_path)
        self.total_requests += 1
        
        # ✅ ENHANCED: Fast cache lookup with validation
        if cache_hash in self.text_cache:
            cached_result = self.text_cache[cache_hash]
            if isinstance(cached_result, str):  # Validate cache entry
                self.cache_hits += 1
                return cached_result
            else:
                # Invalid cache entry, remove it
                del self.text_cache[cache_hash]

        self.cache_misses += 1

        for attempt in range(max_retries):
            try:
                # Validate image file
                if not os.path.exists(image_path):
                    print(f"⚠️ Image file not found: {image_path}")
                    result = ""
                    self.text_cache[cache_hash] = result
                    self._save_cache()  # ✅ SAVE IMMEDIATELY
                    return result
                
                image = Image.open(image_path).convert('RGB')
                
                # Optimize image size
                max_size = 800
                if max(image.size) > max_size:
                    image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
                
                image_b64 = self._encode_image_to_base64(image, quality=80)
                
                # Check base64 size
                base64_size = len(image_b64) * 3 / 4
                if base64_size > 4 * 1024 * 1024:  # 4MB limit
                    print(f"⚠️ Image {os.path.basename(image_path)} too large ({base64_size/1024/1024:.1f}MB), skipping...")
                    result = ""
                    self.text_cache[cache_hash] = result
                    self._save_cache()  # ✅ SAVE IMMEDIATELY
                    return result
                
                # ✅ ENHANCED TRADEMARK PROMPT WITH PROPER FORMAT HANDLING
                enhanced_prompt = """You are a senior trademark attorney with 20+ years of experience analyzing logos for brand protection and infringement cases. Follow these STRICT rules with absolute precision:

RULE 1: ONLY extract text that is CLEARLY and UNAMBIGUOUSLY readable to human eyes
RULE 2: DO NOT extract from pure symbols, icons, stylized graphics, or logo marks without readable text
RULE 3: DO NOT identify brands based on visual recognition - only extract visible text characters
RULE 4: Distinguish between actual BRAND NAMES and generic descriptive terms
RULE 5: For non-Latin scripts, provide English transliteration using standard conventions
RULE 6: If logo is a well-known brand symbol WITHOUT visible text, return empty string
RULE 7: DO NOT hallucinate or assume text that isn't clearly visible

OUTPUT FORMAT RULES:
- If you find a BRAND NAME (unique company/product name): "{Brand Name}, Full extracted text"
- If you find ONLY generic/descriptive terms: "{}, Full extracted text"  
- If you find NO readable text (symbols/icons only): ""

TRANSLITERATION RULES:
- Hindi/Devanagari: जया → Jaya, राम → Ram, सुनील → Sunil
- Arabic: محمد → Muhammad, أحمد → Ahmad
- Chinese: 北京 → Beijing, 上海 → Shanghai
- Use standard international transliteration conventions

BRAND NAME vs GENERIC EXAMPLES:
✅ BRAND NAMES: Nike, Apple, Mercedes-Benz, Coca-Cola, Instagram, McDonald's, Adidas, Samsung, Toyota, Ford, BMW, Pepsi, Starbucks, Amazon, Google, Microsoft, Facebook, Twitter, Tesla, Uber, Airbnb, IND, KONORS, Refox, Aurora, BYD, Chanel, HP, LG
❌ GENERIC TERMS: Sport, Utility, Vehicles, Company, Services, Professional, Premium, Quality, Best, Super, Advanced, Technology, Solutions, Group, International, Global, Enterprise, Corporation, Industries, Manufacturing, Equipment, Products, Systems

DETAILED EXAMPLES:

TEXT WITH BRAND NAMES:
- "Nike Just Do It" → {Nike}, Nike Just Do It
- "McDonald's Restaurant" → {McDonald's}, McDonald's Restaurant
- "Coca-Cola Classic" → {Coca-Cola}, Coca-Cola Classic
- "Mercedes-Benz" → {Mercedes-Benz}, Mercedes-Benz
- "Adidas Equipment" → {Adidas}, Adidas Equipment
- "Samsung Galaxy" → {Samsung}, Samsung Galaxy
- "IND Stocks" → {IND}, IND Stocks
- "KONORS" → {KONORS}, KONORS
- "Aurora Design" → {Aurora}, Aurora Design

GENERIC/DESCRIPTIVE TEXT ONLY:
- "Sport Utility Vehicles" → {}, Sport Utility Vehicles
- "Professional Services" → {}, Professional Services
- "Premium Quality Products" → {}, Premium Quality Products
- "Advanced Technology Solutions" → {}, Advanced Technology Solutions
- "Global Manufacturing Company" → {}, Global Manufacturing Company
- "Best Quality Assurance" → {}, Best Quality Assurance

NON-LATIN SCRIPT WITH TRANSLITERATION:
- "जया" → {Jaya}, Jaya
- "राम इंडस्ट्रीज" → {Ram}, Ram Industries
- "محمد للتجارة" → {Muhammad}, Muhammad Trading
- "北京汽车" → {Beijing}, Beijing Auto

SYMBOLS/ICONS WITHOUT TEXT:
- Pure Apple logo symbol (no text) → ""
- Instagram camera icon (no text) → ""
- Nike swoosh symbol (no text) → ""
- McDonald's golden arches (no text) → ""
- Twitter bird icon (no text) → ""
- Facebook "f" symbol (no text) → ""
- Mercedes-Benz star symbol (no text) → ""
- BMW circular logo (no text) → ""
- Adidas three stripes (no text) → ""
- Pepsi circular logo (no text) → ""

STYLIZED LETTERS/SYMBOLS:
- Stylized "M" for McDonald's (no readable text) → ""
- Stylized "f" for Facebook (no readable text) → ""
- Abstract geometric shapes → ""
- Artistic interpretations of letters → ""
- Logo marks without clear text → ""

MIXED CASES:
- "NIKE" with swoosh symbol → {Nike}, NIKE
- Apple logo with "Apple" text → {Apple}, Apple
- "Instagram" text with camera icon → {Instagram}, Instagram
- "McDonald's" text with golden arches → {McDonald's}, McDonald's

CRITICAL VALIDATION CHECKLIST:
1. Can a human clearly read the text without guessing? If NO → return ""
2. Is the text a recognizable brand name or company identifier? If YES → use {Brand Name} format
3. Is the text only generic/descriptive? If YES → use {} format
4. Is it just a symbol/icon without text? If YES → return ""
5. For non-Latin scripts: transliterate to English using standard conventions
6. When in doubt about brand vs generic → use {} format
7. NEVER identify brands based on visual symbols alone

FORBIDDEN RESPONSES:
- DO NOT return brand names for symbol-only logos
- DO NOT add explanations or reasoning
- DO NOT use phrases like "appears to be" or "seems like"
- DO NOT identify brands based on visual recognition alone
- DO NOT skip transliteration for non-Latin scripts

BRAND NAME DETECTION RULES:
- Company names, even short ones like "IND", "TWC", "BYD" are brand names
- Invented words like "KONORS", "Refox" are brand names
- Person names used as brands like "Aurora" are brand names
- Acronyms used as company names are brand names
- Generic words like "Sport", "Utility", "Vehicles" are NOT brand names

Analyze this logo and respond with ONLY the result:"""
                payload = {
                    "model": self.model_name,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "text", 
                                    "text": enhanced_prompt
                                },
                                {
                                    "type": "image_url", 
                                    "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}
                                }
                            ]
                        }
                    ],
                    "max_tokens": 50,  # ✅ REDUCED: Limit tokens to prevent hallucination
                    "temperature": 0.0,
                    "top_p": 0.1,  # ✅ ADDED: Reduce randomness
                    "frequency_penalty": 0.5,  # ✅ ADDED: Penalize repetitive explanations
                    "presence_penalty": 0.3   # ✅ ADDED: Encourage conciseness
                }
                
                headers = {
                    "Authorization": f"Bearer {self.groq_api_key}",
                    "Content-Type": "application/json"
                }
                
                self._rate_limit()
                
                response = self.session.post(
                    self.groq_api_url, 
                    json=payload, 
                    headers=headers, 
                    timeout=60
                )
                
                if response.status_code == 200:
                    data = response.json()
                    extracted_text = data['choices'][0]['message']['content']
                    cleaned_text = self.clean_extracted_text(extracted_text)
                    
                    # ✅ ENHANCED: Cache the result immediately and save
                    self.text_cache[cache_hash] = cleaned_text
                    self._save_cache()  # ✅ SAVE IMMEDIATELY AFTER EACH EXTRACTION
                    
                    print(f"✅ Processed {os.path.basename(image_path)}: '{cleaned_text}'")
                    return cleaned_text
                    
                elif response.status_code == 429:
                    wait_time = (2 ** attempt) + random.uniform(0, 1)
                    print(f"⏳ Rate limited, waiting {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait_time)
                    continue
                elif response.status_code == 503:
                    wait_time = (2 ** attempt) + random.uniform(0, 2)
                    print(f"🚨 Service unavailable (503), waiting {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})...")
                    time.sleep(wait_time)
                    continue
                else:
                    print(f"❌ API Error for {os.path.basename(image_path)}: {response.status_code}")
                    if attempt == max_retries - 1:
                        result = ""
                        self.text_cache[cache_hash] = result
                        self._save_cache()  # ✅ SAVE EVEN ON FAILURE
                        return result
                    time.sleep(1)
                    continue
                    
            except Exception as e:
                print(f"Error processing {os.path.basename(image_path)} (attempt {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    result = ""
                    self.text_cache[cache_hash] = result
                    self._save_cache()  # ✅ SAVE EVEN ON ERROR
                    return result
                time.sleep(2)
                continue
        
        result = ""
        self.text_cache[cache_hash] = result
        self._save_cache()  # ✅ SAVE FINAL RESULT
        return result

    def extract_text_concurrent(self, image_paths_batch):
        """✅ OPTIMIZED: Process multiple images concurrently with better cache checking"""
        results = {}
        
        # ✅ ENHANCED: Pre-filter cached images to avoid unnecessary processing
        uncached_paths = []
        for image_path in image_paths_batch:
            cache_hash = self._get_file_hash(image_path)
            if cache_hash in self.text_cache and isinstance(self.text_cache[cache_hash], str):
                results[image_path] = self.text_cache[cache_hash]
                self.cache_hits += 1
                self.total_requests += 1
            else:
                uncached_paths.append(image_path)
        
        if uncached_paths:
            def process_single_image(image_path):
                try:
                    result = self.extract_text_from_image(image_path)
                    return image_path, result
                except Exception as e:
                    print(f"Failed to process {os.path.basename(image_path)}: {e}")
                    return image_path, ""
            
            # Use ThreadPoolExecutor for concurrent processing of uncached images only
            with ThreadPoolExecutor(max_workers=self.max_concurrent_requests) as executor:
                future_to_path = {executor.submit(process_single_image, path): path for path in uncached_paths}
                
                for future in as_completed(future_to_path):
                    image_path, result = future.result()
                    results[image_path] = result
        
        return results

    def extract_text_from_folders(self, folder_paths):
        """✅ OPTIMIZED: Enhanced text extraction with trademark format validation"""
        print(f"\n📝 Extracting text using Groq API (TRADEMARK FORMAT MODE)...")
        
        all_image_paths = []
        extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}
        
        # Collect all image paths
        for folder_path in folder_paths:
            if not os.path.exists(folder_path):
                print(f"⚠️ Folder not found: {folder_path}")
                continue
                
            for filename in os.listdir(folder_path):
                if any(filename.lower().endswith(ext) for ext in extensions):
                    full_path = os.path.join(folder_path, filename)
                    try:
                        if os.path.getsize(full_path) > 100:  # Skip very small files
                            all_image_paths.append(full_path)
                    except OSError:
                        continue  # Skip files we can't read
        
        print(f"Processing {len(all_image_paths)} images...")
        
        # ✅ OPTIMIZED: Fast cache validation using batch checking
        uncached_images = []
        cached_count = 0
        invalid_cache_count = 0
        
        print("🔍 Checking cache status...")
        for image_path in tqdm(all_image_paths, desc="Validating cache"):
            cache_hash = self._get_file_hash(image_path)
            if cache_hash in self.text_cache:
                # Validate cache entry
                cached_value = self.text_cache[cache_hash]
                if isinstance(cached_value, str):
                    cached_count += 1
                else:
                    invalid_cache_count += 1
                    uncached_images.append(image_path)
                    del self.text_cache[cache_hash]  # Remove invalid entry
            else:
                uncached_images.append(image_path)
        
        print(f"Found {cached_count} cached results")
        if invalid_cache_count > 0:
            print(f"⚠️ Removed {invalid_cache_count} invalid cache entries")
        print(f"Processing {len(uncached_images)} new images...")
        
        if not uncached_images:
            print("✅ All images already cached!")
            return
        
        # ✅ OPTIMIZED: Process in smaller concurrent batches for better memory management
        batch_size = 6
        batches = [uncached_images[i:i + batch_size] for i in range(0, len(uncached_images), batch_size)]
        
        successful_extractions = 0
        failed_extractions = 0
        
        for i, batch in enumerate(tqdm(batches, desc="Processing concurrent batches")):
            try:
                # Process batch concurrently
                batch_results = self.extract_text_concurrent(batch)
                
                # Update counters
                for image_path, result in batch_results.items():
                    if result.strip():  # Count non-empty results as successful
                        successful_extractions += 1
                    else:
                        failed_extractions += 1
                
                # ✅ OPTIMIZED: Save progress more frequently for safety
                if (i + 1) % 5 == 0:  # Save every 5 batches instead of 10
                    self._save_cache()
                    processed_so_far = min((i + 1) * batch_size, len(uncached_images))
                    print(f"💾 Progress saved: {processed_so_far} images processed...")
                
                # Brief pause between batches
                time.sleep(0.5)  # Reduced from 1 second
                    
            except Exception as e:
                print(f"Batch {i} failed: {e}")
                failed_extractions += len(batch)
                time.sleep(2)
        
        # Final save
        self._save_cache()
        
        # ✅ ENHANCED: Show detailed performance statistics
        total_processed = len(all_image_paths)
        cache_hit_rate = (self.cache_hits / self.total_requests * 100) if self.total_requests > 0 else 0
        
        print(f"✅ Trademark format extraction completed:")
        print(f"   📊 Total images: {total_processed}")
        print(f"   ✅ Successful: {successful_extractions}")
        print(f"   ❌ Failed: {failed_extractions}")
        print(f"   💾 Cached: {cached_count}")
        print(f"   🎯 Cache hit rate: {cache_hit_rate:.1f}%")
        print(f"   ⚡ Cache hits: {self.cache_hits}, Misses: {self.cache_misses}")
        
        if (successful_extractions + failed_extractions) > 0:
            success_rate = (successful_extractions / (successful_extractions + failed_extractions)) * 100
            print(f"   📈 Processing success rate: {success_rate:.1f}%")

    def get_text_for_image(self, image_path):
        """✅ OPTIMIZED: Get cached text for an image with fast lookup"""
        cache_hash = self._get_file_hash(image_path)
        
        if cache_hash in self.text_cache:
            cached_result = self.text_cache[cache_hash]
            if isinstance(cached_result, str):
                self.cache_hits += 1
                self.total_requests += 1
                return cached_result
            else:
                # Invalid cache entry, remove it
                del self.text_cache[cache_hash]
        
        # If not in cache or invalid, extract now
        return self.extract_text_from_image(image_path)

    def get_device_info(self):
        """Get device information with cache stats"""
        cache_hit_rate = (self.cache_hits / self.total_requests * 100) if self.total_requests > 0 else 0
        
        return {
            'device': 'groq_api',
            'model': self.model_name,
            'api_endpoint': self.groq_api_url,
            'cache_enabled': True,
            'concurrent_processing': True,
            'max_concurrent_requests': self.max_concurrent_requests,
            'cache_file': self.cache_file,
            'cache_entries': len(self.text_cache),
            'cache_hit_rate': f"{cache_hit_rate:.1f}%",
            'total_requests': self.total_requests,
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'mode': 'trademark_format'
        }

    def clear_cache(self):
        """Clear all cached OCR results"""
        try:
            if os.path.exists(self.cache_file):
                # Create backup before clearing
                backup_file = f"{self.cache_file}.backup_{int(time.time())}"
                os.rename(self.cache_file, backup_file)
                print(f"💾 Cache backed up to: {backup_file}")
            
            self.text_cache = {}
            # Reset performance counters
            self.cache_hits = 0
            self.cache_misses = 0
            self.total_requests = 0
            print(f"🗑️ Cleared text extraction cache")
        except Exception as e:
            print(f"⚠️ Failed to clear cache: {e}")

    def cache_stats(self):
        """✅ ENHANCED: Display comprehensive cache statistics with performance data"""
        cache_size = len(self.text_cache)
        cache_hit_rate = (self.cache_hits / self.total_requests * 100) if self.total_requests > 0 else 0
        
        try:
            print(f"📊 Trademark Format Cache Statistics:")
            print(f"   📄 Cached extractions: {cache_size}")
            print(f"   📁 Cache location: {self.cache_file}")
            print(f"   🎯 Cache hit rate: {cache_hit_rate:.1f}%")
            print(f"   ⚡ Total requests: {self.total_requests}")
            print(f"   ✅ Cache hits: {self.cache_hits}")
            print(f"   ❌ Cache misses: {self.cache_misses}")
            
            if os.path.exists(self.cache_file):
                file_size = os.path.getsize(self.cache_file)
                file_mtime = os.path.getmtime(self.cache_file)
                file_date = datetime.fromtimestamp(file_mtime).strftime('%Y-%m-%d %H:%M:%S')
                
                print(f"   💾 Cache file size: {file_size / 1024:.2f} KB")
                print(f"   📅 Last modified: {file_date}")
                
                # Analyze cache content
                if self.text_cache:
                    non_empty_count = sum(1 for text in self.text_cache.values() if text.strip())
                    empty_count = cache_size - non_empty_count
                    avg_text_length = sum(len(text) for text in self.text_cache.values()) / cache_size if cache_size > 0 else 0
                    
                    # Count focus word extractions (new format)
                    brand_focus_count = sum(1 for text in self.text_cache.values() if text.strip().startswith('{') and '},' in text and text[1:text.find('},')].strip())
                    generic_focus_count = sum(1 for text in self.text_cache.values() if text.strip().startswith('{}'))
                    
                    print(f"   📈 Entries with text: {non_empty_count}")
                    print(f"   📉 Empty entries: {empty_count}")
                    print(f"   🎯 Brand name extractions: {brand_focus_count}")
                    print(f"   📝 Generic text extractions: {generic_focus_count}")
                    print(f"   📏 Average text length: {avg_text_length:.1f} chars")
            else:
                print(f"   ⚠️ Cache file not found")
                
            print(f"   🚀 Concurrent processing: Enabled ({self.max_concurrent_requests} workers)")
            print(f"   🤖 API Model: {self.model_name}")
            print(f"   ⚖️ Mode: Trademark Format")
            
        except Exception as e:
            print(f"⚠️ Failed to get cache stats: {e}")

    def test_single_extraction(self, image_path):
        """✅ ENHANCED: Test extraction on a single image for debugging"""
        print(f"🧪 Testing trademark format extraction on: {os.path.basename(image_path)}")
        
        # Check if file exists
        if not os.path.exists(image_path):
            print(f"❌ File not found: {image_path}")
            return ""
        
        # Check cache first
        cache_hash = self._get_file_hash(image_path)
        if cache_hash in self.text_cache:
            cached_result = self.text_cache[cache_hash]
            print(f"💾 Found in cache: '{cached_result}'")
            return cached_result
        
        try:
            print(f"🔄 Extracting fresh (not in cache)...")
            result = self.extract_text_from_image(image_path)
            print(f"✅ Extraction successful: '{result}'")
            
            # Parse the result to show focus word separately
            if result and result.startswith('{') and '},' in result:
                focus_end = result.find('},')
                focus_word = result[1:focus_end]
                full_text = result[focus_end + 3:]
                if focus_word:
                    print(f"   🎯 Brand Focus Word: '{focus_word}'")
                else:
                    print(f"   📝 Generic Text (no brand focus)")
                print(f"   📄 Full Text: '{full_text}'")
            elif result:
                print(f"   📄 Extracted Text: '{result}'")
            else:
                print("   📄 No readable text found (symbols/icons only)")
            
            return result
        except Exception as e:
            print(f"❌ Extraction failed: {e}")
            return ""

    def validate_cache_integrity(self):
        """✅ ENHANCED: Validate cache file integrity with detailed reporting"""
        print("🔍 Validating cache integrity...")
        
        if not os.path.exists(self.cache_file):
            print("📄 No cache file to validate")
            return True
        
        try:
            with open(self.cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            if not isinstance(cache_data, dict):
                print("❌ Cache file contains invalid data structure")
                return False
            
            invalid_entries = []
            hallucinated_entries = []
            
            for key, value in cache_data.items():
                if not isinstance(key, str) or not isinstance(value, str):
                    invalid_entries.append(key)
                elif any(pattern in value.lower() for pattern in ["based on", "reasoning:", "analysis:", "therefore"]):
                    hallucinated_entries.append(key)
            
            if invalid_entries or hallucinated_entries:
                print(f"⚠️ Found {len(invalid_entries)} invalid and {len(hallucinated_entries)} hallucinated cache entries")
                print(f"🔧 Cleaning problematic entries...")
                
                # Clean all problematic entries
                for key in invalid_entries + hallucinated_entries:
                    if key in cache_data:
                        del cache_data[key]
                
                # Save cleaned cache
                with open(self.cache_file, 'w', encoding='utf-8') as f:
                    json.dump(cache_data, f, ensure_ascii=False, indent=2)
                
                self.text_cache = cache_data
                print(f"✅ Cache cleaned: {len(cache_data)} valid entries remain")
                return True
            
            print(f"✅ Cache integrity validated: {len(cache_data)} valid entries")
            return True
            
        except json.JSONDecodeError:
            print("❌ Cache file is corrupted (JSON decode error)")
            return False
        except Exception as e:
            print(f"❌ Cache validation failed: {e}")
            return False

    def parse_extracted_result(self, extracted_text):
        """✅ NEW: Parse the extracted result to separate focus word and full text"""
        if not extracted_text or not extracted_text.strip():
            return None, ""
        
        text = extracted_text.strip()
        
        # Check if it follows our format: {FocusWord}, Full Text
        if text.startswith('{') and '},' in text:
            focus_end = text.find('},')
            focus_word = text[1:focus_end].strip()
            full_text = text[focus_end + 2:].strip()
            return focus_word if focus_word else None, full_text
        else:
            # Old format or non-conforming result
            return None, text

    def get_focus_word(self, image_path):
        """✅ NEW: Get just the focus word from an image"""
        extracted_text = self.get_text_for_image(image_path)
        focus_word, _ = self.parse_extracted_result(extracted_text)
        return focus_word

    def get_full_text(self, image_path):
        """✅ NEW: Get just the full text from an image"""
        extracted_text = self.get_text_for_image(image_path)
        _, full_text = self.parse_extracted_result(extracted_text)
        return full_text

    def analyze_trademark_similarity(self, image_path1, image_path2):
        """✅ NEW: Compare two trademarks for similarity analysis"""
        print(f"⚖️ Analyzing trademark similarity:")
        print(f"   Image 1: {os.path.basename(image_path1)}")
        print(f"   Image 2: {os.path.basename(image_path2)}")
        
        text1 = self.get_text_for_image(image_path1)
        text2 = self.get_text_for_image(image_path2)
        
        focus1, full1 = self.parse_extracted_result(text1)
        focus2, full2 = self.parse_extracted_result(text2)
        
        print(f"\n📊 Extraction Results:")
        print(f"   Logo 1 - Focus: '{focus1}', Full: '{full1}'")
        print(f"   Logo 2 - Focus: '{focus2}', Full: '{full2}'")
        
        # Basic similarity analysis
        if focus1 and focus2:
            focus_match = focus1.lower() == focus2.lower()
            print(f"\n🎯 Focus Word Analysis:")
            print(f"   Exact Match: {'✅ YES' if focus_match else '❌ NO'}")
            
            if not focus_match:
                # Simple character similarity
                from difflib import SequenceMatcher
                similarity = SequenceMatcher(None, focus1.lower(), focus2.lower()).ratio()
                print(f"   Similarity Score: {similarity:.2%}")
        
        return {
            'image1': image_path1,
            'image2': image_path2,
            'text1': text1,
            'text2': text2,
            'focus1': focus1,
            'focus2': focus2,
            'full1': full1,
            'full2': full2
        }

    def debug_cache_status(self):
        """Debug cache file status"""
        print(f"\n🔍 CACHE DEBUG INFO:")
        print(f"   📁 Cache directory: {self.cache_dir}")
        print(f"   📄 Cache file path: {self.cache_file}")
        print(f"   📊 Memory cache entries: {len(self.text_cache)}")
        print(f"   💾 Cache file exists: {os.path.exists(self.cache_file)}")
        
        if os.path.exists(self.cache_file):
            file_size = os.path.getsize(self.cache_file)
            print(f"   📏 Cache file size: {file_size} bytes")
            
            # Show first few entries
            if self.text_cache:
                print(f"   📋 Sample cache entries:")
                for i, (key, value) in enumerate(list(self.text_cache.items())[:3]):
                    print(f"      {i+1}. {key[:20]}... → '{value}'")
        else:
            print(f"   ⚠️ Cache file does not exist!")
            
        # Try to create cache file manually
        try:
            self._save_cache()
            print(f"   ✅ Manual cache save successful")
        except Exception as e:
            print(f"   ❌ Manual cache save failed: {e}")

    def preload_cache_for_images(self, image_paths):
        """✅ NEW: Preload cache status for a list of images for faster processing"""
        print(f"🔄 Preloading cache status for {len(image_paths)} images...")
        
        cached_images = []
        uncached_images = []
        
        for image_path in tqdm(image_paths, desc="Checking cache"):
            cache_hash = self._get_file_hash(image_path)
            if cache_hash in self.text_cache and isinstance(self.text_cache[cache_hash], str):
                cached_images.append(image_path)
            else:
                uncached_images.append(image_path)
        
        cache_rate = (len(cached_images) / len(image_paths) * 100) if image_paths else 0
        
        print(f"📊 Cache preload results:")
        print(f"   ✅ Cached: {len(cached_images)} ({cache_rate:.1f}%)")
        print(f"   ❌ Need processing: {len(uncached_images)} ({100-cache_rate:.1f}%)")
        
        return cached_images, uncached_images


def main():
    """
    Main function to demonstrate the enhanced TextExtractor for trademark analysis
    """
    print("🚀 Starting Trademark Format Text Extraction System")
    print("=" * 60)
    
    # Initialize the text extractor
    extractor = TextExtractor(cache_dir="trademark_cache")
    
    # Display device and cache information
    print("\n📋 System Information:")
    device_info = extractor.get_device_info()
    for key, value in device_info.items():
        print(f"   {key}: {value}")
    
    # Show current cache statistics
    print("\n📊 Current Cache Status:")
    extractor.cache_stats()
    
    # Menu-driven interface
    while True:
        print("\n" + "=" * 60)
        print("🎯 TRADEMARK FORMAT TEXT EXTRACTION MENU")
        print("=" * 60)
        print("1. 📁 Extract text from folder(s)")
        print("2. 🖼️  Test single image extraction")
        print("3. ⚖️  Compare two trademarks")
        print("4. 📊 Show cache statistics")
        print("5. 🔍 Validate cache integrity")
        print("6. 🗑️  Clear cache")
        print("7. 🧪 Test on sample images")
        print("8. 📋 Bulk analysis report")
        print("9. 🔧 Debug cache status")
        print("10. ❌ Exit")
        print("=" * 60)
        
        choice = input("Enter your choice (1-10): ").strip()
        
        if choice == '1':
            # Extract text from folders
            print("\n📁 FOLDER TEXT EXTRACTION")
            print("-" * 40)
            
            folders = []
            while True:
                folder_path = input("Enter folder path (or 'done' to finish): ").strip()
                if folder_path.lower() == 'done':
                    break
                if folder_path and os.path.exists(folder_path):
                    folders.append(folder_path)
                    print(f"✅ Added: {folder_path}")
                else:
                    print(f"❌ Folder not found: {folder_path}")
            
            if folders:
                print(f"\n🔄 Processing {len(folders)} folder(s)...")
                start_time = time.time()
                extractor.extract_text_from_folders(folders)
                end_time = time.time()
                print(f"⏱️ Total processing time: {end_time - start_time:.2f} seconds")
            else:
                print("⚠️ No valid folders provided")
        
        elif choice == '2':
            # Test single image
            print("\n🖼️ SINGLE IMAGE TEST")
            print("-" * 40)
            
            image_path = input("Enter image path: ").strip()
            if os.path.exists(image_path):
                result = extractor.test_single_extraction(image_path)
                
                # Parse and display the result
                focus_word, full_text = extractor.parse_extracted_result(result)
                if focus_word:
                    print(f"\n📋 Detailed Analysis:")
                    print(f"   🎯 Brand Focus Word: '{focus_word}'")
                    print(f"   📝 Full Text: '{full_text}'")
                    print(f"   📄 Raw Result: '{result}'")
                elif result and result.startswith('{}'):
                    print(f"\n📋 Detailed Analysis:")
                    print(f"   📝 Generic Text (no brand focus): '{full_text}'")
                    print(f"   📄 Raw Result: '{result}'")
                elif result:
                    print(f"📄 Extracted Text: '{result}'")
                else:
                    print("📄 No readable text found (symbols/icons only)")
            else:
                print(f"❌ Image not found: {image_path}")
        
        elif choice == '3':
            # Compare two trademarks
            print("\n⚖️ TRADEMARK COMPARISON")
            print("-" * 40)
            
            image1 = input("Enter first image path: ").strip()
            image2 = input("Enter second image path: ").strip()
            
            if os.path.exists(image1) and os.path.exists(image2):
                comparison = extractor.analyze_trademark_similarity(image1, image2)
                
                print(f"\n📊 Comparison Summary:")
                print(f"   Image 1: {os.path.basename(comparison['image1'])}")
                print(f"   Image 2: {os.path.basename(comparison['image2'])}")
                print(f"   Focus Words: '{comparison['focus1']}' vs '{comparison['focus2']}'")
                
                if comparison['focus1'] and comparison['focus2']:
                    if comparison['focus1'].lower() == comparison['focus2'].lower():
                        print("   🚨 POTENTIAL CONFLICT: Identical focus words!")
                    else:
                        print("   ✅ Different focus words")
            else:
                print("❌ One or both image files not found")
        
        elif choice == '4':
            # Show cache statistics
            print("\n📊 CACHE STATISTICS")
            print("-" * 40)
            extractor.cache_stats()
        
        elif choice == '5':
            # Validate cache integrity
            print("\n🔍 CACHE VALIDATION")
            print("-" * 40)
            is_valid = extractor.validate_cache_integrity()
            if is_valid:
                print("✅ Cache is healthy and valid")
            else:
                print("❌ Cache has issues - consider clearing and rebuilding")
        
        elif choice == '6':
            # Clear cache
            print("\n🗑️ CLEAR CACHE")
            print("-" * 40)
            confirm = input("Are you sure you want to clear the cache? (yes/no): ").strip().lower()
            if confirm in ['yes', 'y']:
                extractor.clear_cache()
                print("✅ Cache cleared successfully")
            else:
                print("❌ Cache clear cancelled")
        
        elif choice == '7':
            # Test on sample images (if available)
            print("\n🧪 SAMPLE IMAGE TESTING")
            print("-" * 40)
            
            # Look for common sample directories
            sample_dirs = ['samples', 'test_images', 'logos', 'trademarks']
            found_samples = []
            
            for sample_dir in sample_dirs:
                if os.path.exists(sample_dir):
                    found_samples.append(sample_dir)
            
            if found_samples:
                print(f"Found sample directories: {found_samples}")
                for sample_dir in found_samples:
                    print(f"\n📁 Testing samples in: {sample_dir}")
                    extractor.extract_text_from_folders([sample_dir])
            else:
                print("⚠️ No sample directories found")
                print("Create a 'samples' folder with test images to use this feature")
        
        elif choice == '8':
            # Bulk analysis report
            print("\n📋 BULK ANALYSIS REPORT")
            print("-" * 40)
            
            folder_path = input("Enter folder path for analysis: ").strip()
            if os.path.exists(folder_path):
                # Get all images in folder
                extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif'}
                image_files = []
                
                for filename in os.listdir(folder_path):
                    if any(filename.lower().endswith(ext) for ext in extensions):
                        full_path = os.path.join(folder_path, filename)
                        if os.path.getsize(full_path) > 100:
                            image_files.append(full_path)
                
                if image_files:
                    print(f"\n📊 Analyzing {len(image_files)} images...")
                    
                    # Process all images
                    extractor.extract_text_from_folders([folder_path])
                    
                    # Generate report
                    print(f"\n📋 ANALYSIS REPORT")
                    print("=" * 50)
                    
                    brand_focus_words = {}
                    generic_text_count = 0
                    empty_count = 0
                    total_processed = 0
                    
                    for image_path in image_files:
                        result = extractor.get_text_for_image(image_path)
                        total_processed += 1
                        
                        if result.strip():
                            focus_word, full_text = extractor.parse_extracted_result(result)
                            if focus_word:
                                # Has brand focus word
                                if focus_word.lower() not in brand_focus_words:
                                    brand_focus_words[focus_word.lower()] = []
                                brand_focus_words[focus_word.lower()].append({
                                    'file': os.path.basename(image_path),
                                    'focus': focus_word,
                                    'full': full_text
                                })
                                print(f"🎯 {os.path.basename(image_path)}: '{result}'")
                            else:
                                # Generic text only
                                generic_text_count += 1
                                print(f"📝 {os.path.basename(image_path)}: '{result}'")
                        else:
                            empty_count += 1
                            print(f"❌ {os.path.basename(image_path)}: No text")
                    
                    # Summary
                    print(f"\n📈 SUMMARY:")
                    print(f"   Total images: {total_processed}")
                    print(f"   With brand focus: {len([item for sublist in brand_focus_words.values() for item in sublist])}")
                    print(f"   With generic text only: {generic_text_count}")
                    print(f"   Without text: {empty_count}")
                    print(f"   Unique brand names: {len(brand_focus_words)}")
                    
                    # Show potential conflicts
                    print(f"\n🚨 POTENTIAL BRAND CONFLICTS:")
                    for focus_word, entries in brand_focus_words.items():
                        if len(entries) > 1:
                            print(f"   '{focus_word}' appears in {len(entries)} files:")
                            for entry in entries:
                                print(f"     - {entry['file']}")
                
                else:
                    print("❌ No valid image files found in folder")
            else:
                print(f"❌ Folder not found: {folder_path}")
        
        elif choice == '9':
            # Debug cache status
            print("\n🔧 DEBUG CACHE STATUS")
            print("-" * 40)
            extractor.debug_cache_status()
        
        elif choice == '10':
            # Exit
            print("\n👋 Exiting Trademark Format Text Extraction System")
            print("💾 Final cache save...")
            extractor._save_cache()
            
            # Show final statistics
            print("\n📊 Final Statistics:")
            extractor.cache_stats()
            print("\n✅ System shutdown complete")
            break
        
        else:
            print("❌ Invalid choice. Please enter a number between 1-10.")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️ Process interrupted by user")
        print("💾 Attempting to save cache...")
        # Try to save cache if possible
        try:
            extractor = TextExtractor()
            extractor._save_cache()
            print("✅ Cache saved successfully")
        except:
            print("⚠️ Could not save cache")
        print("👋 Goodbye!")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        print("🔧 Please check your setup and try again")
