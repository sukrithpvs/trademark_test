import os
import cv2
import numpy as np
import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import warnings
import hashlib
import pickle
import faiss
from sklearn.cluster import MiniBatchKMeans
from tqdm import tqdm
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from queue import Queue
import multiprocessing as mp

warnings.filterwarnings('ignore')

class VisualSimilarityAnalyzer:
    def __init__(self, cache_dir="visual_cache"):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)
        
        # Setup device with MPS support
        if torch.cuda.is_available():
            self.device = "cuda"
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            self.device = "mps"
        else:
            self.device = "cpu"
        
        print(f"Using device: {self.device}")
        
        # Load specified models: DenseNet121, GoogleNet, VGG16
        print("Loading visual models...")
        self.densenet121 = models.densenet121(weights=models.DenseNet121_Weights.IMAGENET1K_V1).to(self.device)
        self.googlenet = models.googlenet(weights=models.GoogLeNet_Weights.IMAGENET1K_V1).to(self.device)
        self.vgg16 = models.vgg16(weights=models.VGG16_Weights.IMAGENET1K_V1).to(self.device)
        
        # Set to eval mode
        self.densenet121.eval()
        self.googlenet.eval()
        self.vgg16.eval()
        
        # ✅ FIXED: More permissive SIFT parameters
        self.sift = cv2.SIFT_create(
            nfeatures=1000,
            nOctaveLayers=3,
            contrastThreshold=0.02,
            edgeThreshold=20,
            sigma=1.6
        )
        
        # Transforms for deep learning models
        self.transform = transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        # Feature weights optimized for trademark comparison
        self.weights = {
            'sift': 0.35,        
            'vgg16': 0.25,       
            'densenet121': 0.25, 
            'googlenet': 0.15    
        }
        
        # Initialize BoVW for SIFT
        self.bovw_clusters = 256
        self.bovw_kmeans = None
        
        # ✅ NEW: Separate indexes and metadata for each folder
        self.folder_indexes = {}  # {folder_path: {feature_type: index}}
        self.folder_image_paths = {}  # {folder_path: [image_paths]}
        self.folder_features = {}  # {folder_path: {image_path: features}}
        self.features_cache = {}  # Global cache for compatibility
        
        # ✅ NEW: Multi-threading configuration
        self.max_workers = min(mp.cpu_count(), 8)
        self.batch_size = 64 if self.device in ['cuda', 'mps'] else 32
        
        print("✅ Visual similarity system ready with separate folder indexing")

    def _get_image_files(self, folder_path, min_file_size=100, show_diagnostics=False):
        """✅ MULTI-THREADED: Fast image file detection"""
        extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp', '.gif'}
        system_files = {'.ds_store', 'thumbs.db', 'desktop.ini', '.directory', 
                       '._.ds_store', '._thumbs.db', '.fseventsd', '.spotlight-v100'}
        
        def validate_file(filename):
            """Multi-threaded file validation"""
            try:
                if filename.startswith('.') or filename.lower() in system_files:
                    return None
                
                if not any(filename.lower().endswith(ext) for ext in extensions):
                    return None
                
                full_path = os.path.join(folder_path, filename)
                
                # Quick size and validity check
                try:
                    file_size = os.path.getsize(full_path)
                    if file_size < min_file_size:
                        return None
                except:
                    return None
                
                # Fast image validation
                if self._validate_image_file_fast(full_path):
                    return full_path
                return None
                    
            except Exception:
                return None
        
        try:
            all_files = os.listdir(folder_path)
            if show_diagnostics:
                print(f"\n📂 Analyzing folder: {folder_path}")
                print(f"📊 Total files found: {len(all_files)}")
            
        except Exception as e:
            print(f"❌ Error reading folder {folder_path}: {e}")
            return []
        
        # ✅ MULTI-THREADED: Parallel file validation
        valid_files = []
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_file = {executor.submit(validate_file, filename): filename for filename in all_files}
            
            for future in as_completed(future_to_file):
                result = future.result()
                if result:
                    valid_files.append(result)
        
        valid_files = sorted(valid_files)
        
        if show_diagnostics:
            stats = {
                'total_files': len(all_files),
                'valid_files': len(valid_files),
                'filtered_out': len(all_files) - len(valid_files)
            }
            
            print(f"📈 File Analysis Results:")
            print(f"   📁 Total files in folder: {stats['total_files']}")
            print(f"   ✅ Valid image files: {stats['valid_files']}")
            print(f"   ❌ Filtered out: {stats['filtered_out']}")
            print(f"   📊 Processing efficiency: {(stats['valid_files']/stats['total_files']*100):.1f}%")
        
        return valid_files

    def _validate_image_file_fast(self, image_path):
        """✅ OPTIMIZED: Ultra-fast image validation"""
        try:
            with Image.open(image_path) as img:
                return img.size[0] > 0 and img.size[1] > 0
        except Exception:
            return False

    def _load_image(self, image_path):
        """✅ OPTIMIZED: Fast image loading"""
        try:
            image = cv2.imread(image_path)
            if image is None:
                try:
                    pil_image = Image.open(image_path)
                    image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
                except Exception:
                    return None
            
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Resize if too large
            h, w = image_rgb.shape[:2]
            if max(h, w) > 1024:
                scale = 1024 / max(h, w)
                new_w, new_h = int(w * scale), int(h * scale)
                image_rgb = cv2.resize(image_rgb, (new_w, new_h))
            
            return image_rgb
        except Exception:
            return None

    def _analyze_image_content_fast(self, image_rgb):
        """✅ OPTIMIZED: Fast content analysis"""
        try:
            gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
            
            mean_intensity = np.mean(gray)
            std_intensity = np.std(gray)
            
            extremely_dark = mean_intensity < 15
            very_low_contrast = std_intensity < 10
            
            edges = cv2.Canny(gray, 30, 100)
            edge_density = np.sum(edges > 0) / edges.size
            no_edges = edge_density < 0.005
            
            poor_quality = (extremely_dark and very_low_contrast and no_edges)
            
            return {
                'mean_intensity': mean_intensity,
                'std_intensity': std_intensity,
                'edge_density': edge_density,
                'extremely_dark': extremely_dark,
                'very_low_contrast': very_low_contrast,
                'content_quality': 'poor' if poor_quality else 'good'
            }
        except:
            return {'content_quality': 'poor'}

    def _extract_improved_sift_features(self, image_rgb):
        """✅ FIXED: SIFT extraction with multiple fallback strategies"""
        try:
            gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
            content_analysis = self._analyze_image_content_fast(image_rgb)
            
            # Progressive preprocessing strategies
            if content_analysis['extremely_dark'] or content_analysis['very_low_contrast']:
                clahe = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8,8))
                gray = clahe.apply(gray)
                
                if content_analysis['mean_intensity'] < 20:
                    gray = cv2.equalizeHist(gray)
                    
                if content_analysis['mean_intensity'] < 30:
                    gamma = 1.5
                    gray = np.power(gray / 255.0, 1/gamma) * 255
                    gray = gray.astype(np.uint8)
            else:
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
                gray = clahe.apply(gray)
            
            # Try multiple SIFT parameter sets
            keypoints, descriptors = self.sift.detectAndCompute(gray, None)
            
            # Fallback with more permissive parameters
            if descriptors is None or len(descriptors) == 0:
                temp_sift = cv2.SIFT_create(
                    nfeatures=1000,
                    nOctaveLayers=3,
                    contrastThreshold=0.01,
                    edgeThreshold=25,
                    sigma=1.6
                )
                keypoints, descriptors = temp_sift.detectAndCompute(gray, None)
            
            # Try different preprocessing
            if descriptors is None or len(descriptors) == 0:
                gray_eq = cv2.equalizeHist(gray)
                keypoints, descriptors = self.sift.detectAndCompute(gray_eq, None)
            
            # Try with blur
            if descriptors is None or len(descriptors) == 0:
                gray_blur = cv2.GaussianBlur(gray, (5, 5), 0)
                keypoints, descriptors = self.sift.detectAndCompute(gray_blur, None)
            
            # Final fallback - use image statistics
            if descriptors is None or len(descriptors) == 0:
                hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
                hist = hist.flatten()
                if len(hist) < self.bovw_clusters:
                    hist = np.pad(hist, (0, self.bovw_clusters - len(hist)))
                else:
                    hist = hist[:self.bovw_clusters]
                
                if hist.sum() > 0:
                    hist = hist / hist.sum()
                else:
                    hist = np.ones(self.bovw_clusters) / self.bovw_clusters
                    
                return hist.astype(np.float32)
            
            # Limit descriptors for efficiency
            if len(descriptors) > 300:
                responses = [kp.response for kp in keypoints]
                indices = np.argsort(responses)[-300:]
                descriptors = descriptors[indices]
            
            # BoVW processing
            if self.bovw_kmeans is not None:
                try:
                    labels = self.bovw_kmeans.predict(descriptors)
                    hist, _ = np.histogram(labels, bins=range(self.bovw_clusters + 1))
                    hist = hist.astype(np.float32)
                    
                    if hist.sum() > 0:
                        hist = hist / hist.sum()
                        if content_analysis['content_quality'] == 'poor':
                            hist = hist * 0.9
                    else:
                        hist = np.ones(self.bovw_clusters) / self.bovw_clusters
                    
                    return hist
                except Exception:
                    pass
            
            # Fallback to descriptor mean
            feature_vector = np.mean(descriptors, axis=0)
            if len(feature_vector) < self.bovw_clusters:
                feature_vector = np.pad(feature_vector, (0, self.bovw_clusters - len(feature_vector)))
            else:
                feature_vector = feature_vector[:self.bovw_clusters]
            
            norm = np.linalg.norm(feature_vector)
            if norm > 0:
                feature_vector = feature_vector / norm
                if content_analysis['content_quality'] == 'poor':
                    feature_vector = feature_vector * 0.95
            else:
                feature_vector = np.ones(self.bovw_clusters) / np.sqrt(self.bovw_clusters)
            
            return feature_vector.astype(np.float32)
                
        except Exception as e:
            fallback = np.random.normal(0, 0.1, self.bovw_clusters)
            return (fallback / np.linalg.norm(fallback)).astype(np.float32)

    def _extract_deep_features_batch(self, image_paths_batch):
        """✅ MULTI-THREADED: Batch deep feature extraction"""
        batch_features = {
            'vgg16': {},
            'densenet121': {},
            'googlenet': {}
        }
        
        # Load images in parallel
        def load_image_for_batch(img_path):
            image_rgb = self._load_image(img_path)
            if image_rgb is not None:
                try:
                    pil_image = Image.fromarray(image_rgb)
                    tensor = self.transform(pil_image)
                    return img_path, tensor
                except Exception:
                    return img_path, None
            return img_path, None
        
        # ✅ MULTI-THREADED: Parallel image loading
        valid_paths = []
        batch_tensors = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(load_image_for_batch, path) for path in image_paths_batch]
            
            for future in as_completed(futures):
                img_path, tensor = future.result()
                if tensor is not None:
                    valid_paths.append(img_path)
                    batch_tensors.append(tensor)
        
        if not batch_tensors:
            return batch_features
        
        # Stack tensors and move to device
        batch_tensor = torch.stack(batch_tensors).to(self.device)
        
        # Extract features from all models
        with torch.no_grad():
            if self.device == 'mps':
                with torch.inference_mode():
                    vgg_features = self._extract_vgg_batch(batch_tensor)
                    densenet_features = self._extract_densenet_batch(batch_tensor)
                    googlenet_features = self._extract_googlenet_batch(batch_tensor)
            else:
                vgg_features = self._extract_vgg_batch(batch_tensor)
                densenet_features = self._extract_densenet_batch(batch_tensor)
                googlenet_features = self._extract_googlenet_batch(batch_tensor)
        
        # Store features
        for i, path in enumerate(valid_paths):
            batch_features['vgg16'][path] = vgg_features[i].cpu().numpy()
            batch_features['densenet121'][path] = densenet_features[i].cpu().numpy()
            batch_features['googlenet'][path] = googlenet_features[i].cpu().numpy()
        
        return batch_features

    def _extract_vgg_batch(self, batch_tensor):
        """✅ OPTIMIZED: VGG feature extraction"""
        features = self.vgg16.features(batch_tensor)
        features = self.vgg16.avgpool(features)
        features = torch.flatten(features, 1)
        features = self.vgg16.classifier[0](features)
        return torch.nn.functional.normalize(features, p=2, dim=1)

    def _extract_densenet_batch(self, batch_tensor):
        """✅ OPTIMIZED: DenseNet feature extraction"""
        features = self.densenet121.features(batch_tensor)
        features = torch.nn.functional.relu(features, inplace=True)
        features = torch.nn.functional.adaptive_avg_pool2d(features, (1, 1))
        features = torch.flatten(features, 1)
        return torch.nn.functional.normalize(features, p=2, dim=1)

    def _extract_googlenet_batch(self, batch_tensor):
        """✅ OPTIMIZED: GoogleNet feature extraction"""
        features = self.googlenet(batch_tensor)
        if isinstance(features, tuple):
            features = features[0]
        return torch.nn.functional.normalize(features, p=2, dim=1)

    def _create_bovw_vocabulary(self, all_descriptors):
        """✅ OPTIMIZED: BoVW vocabulary creation"""
        print(f"Creating BoVW vocabulary with {self.bovw_clusters} clusters...")
        
        if len(all_descriptors) < self.bovw_clusters:
            self.bovw_clusters = max(16, len(all_descriptors) // 2)
            print(f"🔧 Adjusted to {self.bovw_clusters} clusters")
        
        try:
            self.bovw_kmeans = MiniBatchKMeans(
                n_clusters=self.bovw_clusters,
                batch_size=min(1000, len(all_descriptors)),
                max_iter=100,
                random_state=42
            )
            
            descriptors_array = np.array(all_descriptors)
            self.bovw_kmeans.fit(descriptors_array)
            
            print(f"✅ BoVW vocabulary created with {self.bovw_clusters} clusters")
            return True
            
        except Exception as e:
            print(f"❌ BoVW creation failed: {e}")
            self.bovw_kmeans = None
            print("🔧 Continuing without BoVW encoding")
            return False

    def _extract_sift_features_threaded(self, image_paths):
        """✅ MULTI-THREADED: SIFT feature extraction"""
        def process_image(img_path):
            try:
                image_rgb = self._load_image(img_path)
                if image_rgb is not None:
                    features = self._extract_improved_sift_features(image_rgb)
                    return img_path, features
                return img_path, np.zeros(self.bovw_clusters)
            except Exception:
                return img_path, np.zeros(self.bovw_clusters)
        
        results_dict = {}
        
        # ✅ MULTI-THREADED: Parallel SIFT extraction
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(process_image, path) for path in image_paths]
            
            for future in tqdm(as_completed(futures), total=len(futures), desc="SIFT extraction (threaded)"):
                try:
                    path, features = future.result()
                    results_dict[path] = features
                except Exception:
                    pass
        
        return results_dict

    def _build_separate_folder_indexes(self, folder_paths):
        """✅ NEW: Build separate indexes for each folder"""
        print("\n🏗️ Building separate visual indexes for each folder...")
        
        # ✅ STEP 1: Collect all images and build BoVW vocabulary
        all_image_paths = []
        folder_image_lists = {}
        
        for folder_path in folder_paths:
            folder_images = self._get_image_files(folder_path, min_file_size=100, show_diagnostics=True)
            folder_image_lists[folder_path] = folder_images
            all_image_paths.extend(folder_images)
            print(f"   📁 {folder_path}: {len(folder_images)} valid images")
        
        print(f"\n📊 Total images across all folders: {len(all_image_paths)}")
        
        # ✅ STEP 2: Build BoVW vocabulary using samples from all folders
        print("Collecting SIFT descriptors for BoVW vocabulary...")
        all_sift_descriptors = []
        
        sample_size = min(100, len(all_image_paths))
        sample_images = np.random.choice(all_image_paths, sample_size, replace=False)
        
        def collect_sift_descriptors(img_path):
            image_rgb = self._load_image(img_path)
            if image_rgb is not None:
                gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
                clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
                gray_clahe = clahe.apply(gray)
                _, descriptors = self.sift.detectAndCompute(gray_clahe, None)
                
                if descriptors is None or len(descriptors) == 0:
                    gray_eq = cv2.equalizeHist(gray)
                    _, descriptors = self.sift.detectAndCompute(gray_eq, None)
                
                if descriptors is not None and len(descriptors) > 0:
                    if len(descriptors) > 100:
                        descriptors = descriptors[:100]
                    return descriptors
            return None
        
        # ✅ MULTI-THREADED: Parallel descriptor collection
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(collect_sift_descriptors, img_path) for img_path in sample_images]
            
            for future in tqdm(as_completed(futures), total=len(futures), desc="SIFT sampling"):
                descriptors = future.result()
                if descriptors is not None:
                    all_sift_descriptors.extend(descriptors)
        
        # Create BoVW vocabulary
        if len(all_sift_descriptors) >= 32:
            self._create_bovw_vocabulary(all_sift_descriptors)
        else:
            print(f"⚠️ Too few SIFT descriptors ({len(all_sift_descriptors)}) for BoVW")
            self.bovw_kmeans = None
        
        # ✅ STEP 3: Process each folder separately
        for folder_path in folder_paths:
            print(f"\n🔨 Processing folder: {folder_path}")
            folder_images = folder_image_lists[folder_path]
            
            if not folder_images:
                print(f"⚠️ No images found in {folder_path}")
                continue
            
            # Initialize folder data structures
            self.folder_image_paths[folder_path] = folder_images
            self.folder_features[folder_path] = {}
            self.folder_indexes[folder_path] = {}
            
            # ✅ MULTI-THREADED: Extract features for this folder
            folder_feature_matrices = {
                'sift': [],
                'vgg16': [],
                'densenet121': [],
                'googlenet': []
            }
            
            valid_paths = []
            
            # Process SIFT features
            print(f"   🔍 Extracting SIFT features...")
            sift_features = self._extract_sift_features_threaded(folder_images)
            
            # Process deep features in batches
            print(f"   🧠 Extracting deep features...")
            for i in tqdm(range(0, len(folder_images), self.batch_size), desc="   Deep features"):
                batch_paths = folder_images[i:i + self.batch_size]
                batch_features = self._extract_deep_features_batch(batch_paths)
                
                # Combine SIFT and deep features
                for img_path in batch_paths:
                    if (img_path in sift_features and 
                        img_path in batch_features['vgg16']):
                        
                        combined_features = {
                            'sift': sift_features[img_path],
                            'vgg16': batch_features['vgg16'][img_path],
                            'densenet121': batch_features['densenet121'][img_path],
                            'googlenet': batch_features['googlenet'][img_path]
                        }
                        
                        # Store in folder-specific and global caches
                        self.folder_features[folder_path][img_path] = combined_features
                        self.features_cache[img_path] = combined_features  # For compatibility
                        
                        valid_paths.append(img_path)
                        
                        # Add to feature matrices for indexing
                        for feature_type in folder_feature_matrices.keys():
                            folder_feature_matrices[feature_type].append(combined_features[feature_type])
                
                # Memory cleanup
                if self.device == 'mps':
                    torch.mps.empty_cache()
            
            # ✅ STEP 4: Build separate FAISS indexes for this folder
            print(f"   📈 Building FAISS indexes for {folder_path}...")
            for feature_type, feature_list in folder_feature_matrices.items():
                if feature_list:
                    features_array = np.array(feature_list).astype('float32')
                    
                    # Normalize features
                    norms = np.linalg.norm(features_array, axis=1, keepdims=True)
                    norms[norms == 0] = 1
                    features_array = features_array / norms
                    
                    # Create FAISS index for this folder and feature type
                    dimension = features_array.shape[1]
                    index = faiss.IndexFlatIP(dimension)
                    index.add(features_array)
                    
                    self.folder_indexes[folder_path][feature_type] = {
                        'index': index,
                        'image_paths': valid_paths.copy()
                    }
                    
                    print(f"      ✅ {feature_type}: {len(feature_list)} vectors × {dimension}D")
            
            print(f"   ✅ Folder {folder_path} processed: {len(valid_paths)} images")
        
        print(f"\n✅ Separate indexes built for {len(folder_paths)} folders")
        total_processed = sum(len(paths) for paths in self.folder_image_paths.values())
        print(f"   📊 Total images processed: {total_processed}")

    def _save_separate_indexes(self, filepath):
        """✅ NEW: Save separate folder indexes"""
        try:
            data = {
                'folder_indexes': {},
                'folder_image_paths': self.folder_image_paths,
                'folder_features': self.folder_features,
                'features_cache': self.features_cache,
                'bovw_kmeans': self.bovw_kmeans,
                'weights': self.weights
            }
            
            # Serialize separate FAISS indexes
            for folder_path, folder_data in self.folder_indexes.items():
                data['folder_indexes'][folder_path] = {}
                for feature_type, index_data in folder_data.items():
                    if index_data and 'index' in index_data:
                        data['folder_indexes'][folder_path][feature_type] = {
                            'index': faiss.serialize_index(index_data['index']),
                            'image_paths': index_data['image_paths']
                        }
            
            with open(filepath, 'wb') as f:
                pickle.dump(data, f, protocol=pickle.HIGHEST_PROTOCOL)
            
            print(f"✅ Separate folder indexes saved to {filepath}")
            total_features = sum(len(features) for features in self.folder_features.values())
            print(f"   📄 Total features cached: {total_features}")
            
        except Exception as e:
            print(f"⚠️ Failed to save separate indexes: {e}")

    def _load_separate_indexes(self, filepath):
        """✅ NEW: Load separate folder indexes"""
        try:
            with open(filepath, 'rb') as f:
                data = pickle.load(f)
            
            # Deserialize separate FAISS indexes
            self.folder_indexes = {}
            for folder_path, folder_data in data['folder_indexes'].items():
                self.folder_indexes[folder_path] = {}
                for feature_type, index_data in folder_data.items():
                    if index_data and 'index' in index_data:
                        self.folder_indexes[folder_path][feature_type] = {
                            'index': faiss.deserialize_index(index_data['index']),
                            'image_paths': index_data['image_paths']
                        }
            
            # Load other data
            self.folder_image_paths = data['folder_image_paths']
            self.folder_features = data['folder_features']
            self.features_cache = data['features_cache']
            self.bovw_kmeans = data['bovw_kmeans']
            self.weights = data.get('weights', self.weights)
            
            print(f"✅ Separate folder indexes loaded from {filepath}")
            total_features = sum(len(features) for features in self.folder_features.values())
            print(f"   📄 Total features loaded: {total_features}")
            print(f"   📁 Folders loaded: {list(self.folder_indexes.keys())}")
            return True
            
        except Exception as e:
            print(f"⚠️ Failed to load separate indexes: {e}")
            return False

    def prepare_folders(self, folder_paths, use_cache=True):
        """✅ NEW: Prepare folders with separate indexing"""
        # Create cache key
        cache_elements = []
        for folder_path in sorted(folder_paths):
            try:
                folder_stat = os.stat(folder_path)
                cache_elements.append(f"{folder_path}_{folder_stat.st_mtime}")
            except:
                cache_elements.append(folder_path)
        
        cache_key = hashlib.md5("".join(cache_elements).encode()).hexdigest()[:16]
        index_cache_path = os.path.join(self.cache_dir, f"separate_indexes_{cache_key}.pkl")
        
        # Try to load from cache
        if use_cache and os.path.exists(index_cache_path):
            print("📁 Loading cached separate folder indexes...")
            if self._load_separate_indexes(index_cache_path):
                print("✅ Cached separate indexes loaded successfully")
                return
            else:
                print("🔄 Cache load failed, building new separate indexes...")
        
        # Build new separate indexes
        print("🔄 Building new separate folder indexes...")
        self._build_separate_folder_indexes(folder_paths)
        
        # Save to cache
        if use_cache:
            self._save_separate_indexes(index_cache_path)

    def calculate_visual_similarity_optimized(self, image_path1, image_path2):
        """✅ OPTIMIZED: Ultra-fast similarity calculation using cached features"""
        # Use pre-cached features
        features1 = self.features_cache.get(image_path1)
        features2 = self.features_cache.get(image_path2)
        
        if not features1 or not features2:
            return 0.0, {}
        
        similarities = {}
        
        # ✅ OPTIMIZED: Vectorized similarity calculation
        for feature_type in ['sift', 'vgg16', 'densenet121', 'googlenet']:
            f1 = features1[feature_type]
            f2 = features2[feature_type]
            
            # Fast cosine similarity
            f1_norm = f1 / (np.linalg.norm(f1) + 1e-8)
            f2_norm = f2 / (np.linalg.norm(f2) + 1e-8)
            
            similarity = np.dot(f1_norm, f2_norm)
            similarities[feature_type] = max(0, similarity * 100)
        
        # Weighted combination
        overall = sum(similarities[ft] * self.weights[ft] for ft in similarities.keys())
        
        return overall, similarities

    def compare_folders_optimized(self, folder1_path, folder2_path, similarity_threshold=70.0, use_reverse_comparison=True):
        """✅ NEW: Optimized cross-folder comparison using separate indexes"""
        print(f"\n🔍 Optimized comparison: {folder1_path} vs {folder2_path}")
        
        # Check if folders are prepared
        if folder1_path not in self.folder_indexes or folder2_path not in self.folder_indexes:
            print("❌ Folders not prepared. Call prepare_folders() first.")
            return []
        
        # Get folder data
        folder1_images = self.folder_image_paths[folder1_path]
        folder2_images = self.folder_image_paths[folder2_path]
        
        print(f"📊 Comparing {len(folder1_images)} vs {len(folder2_images)} images")
        
        # ✅ OPTIMIZATION: Use smaller folder as queries for efficiency
        if len(folder1_images) > len(folder2_images):
            query_folder = folder2_path
            target_folder = folder1_path
            query_images = folder2_images
            target_images = folder1_images
        else:
            query_folder = folder1_path
            target_folder = folder2_path
            query_images = folder1_images
            target_images = folder2_images
        
        print(f"🎯 Using {len(query_images)} images as queries against {len(target_images)} targets")
        
        results = []
        
        def process_query_batch(query_batch):
            """✅ MULTI-THREADED: Process a batch of query images"""
            batch_results = []
            
            for query_img in query_batch:
                query_features = self.features_cache.get(query_img)
                if not query_features:
                    continue
                
                # ✅ OPTIMIZED: Fast FAISS search for each feature type
                combined_similarities = {}
                
                for feature_type in ['sift', 'vgg16', 'densenet121', 'googlenet']:
                    if feature_type in self.folder_indexes[target_folder]:
                        target_index_data = self.folder_indexes[target_folder][feature_type]
                        target_index = target_index_data['index']
                        target_paths = target_index_data['image_paths']
                        
                        # Prepare query vector
                        query_vector = query_features[feature_type].reshape(1, -1).astype('float32')
                        query_norm = np.linalg.norm(query_vector)
                        if query_norm > 0:
                            query_vector = query_vector / query_norm
                        
                        # Fast FAISS search - get all matches
                        scores, indices = target_index.search(query_vector, len(target_paths))
                        
                        # Process all results
                        for score, idx in zip(scores[0], indices[0]):
                            if 0 <= idx < len(target_paths):
                                target_img = target_paths[idx]
                                similarity_score = max(0, score * 100)
                                
                                if target_img not in combined_similarities:
                                    combined_similarities[target_img] = {}
                                combined_similarities[target_img][feature_type] = similarity_score
                
                # Calculate final weighted scores
                for target_img, feature_scores in combined_similarities.items():
                    final_score = sum(feature_scores.get(ft, 0) * self.weights[ft] 
                                    for ft in self.weights.keys())
                    
                    if final_score >= similarity_threshold:
                        # Determine correct image1/image2 order
                        if query_folder == folder1_path:
                            img1, img2 = query_img, target_img
                        else:
                            img1, img2 = target_img, query_img
                        
                        batch_results.append({
                            'image1': img1,
                            'image2': img2,
                            'visual_score': final_score,
                            'feature_breakdown': feature_scores,
                            'comparison_direction': f"{query_folder} -> {target_folder}"
                        })
            
            return batch_results
        
        # ✅ MULTI-THREADED: Process queries in parallel batches
        query_batch_size = max(1, len(query_images) // self.max_workers)
        query_batches = [query_images[i:i + query_batch_size] 
                        for i in range(0, len(query_images), query_batch_size)]
        
        print(f"🔀 Processing {len(query_batches)} query batches in parallel...")
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_batch = {executor.submit(process_query_batch, batch): i 
                             for i, batch in enumerate(query_batches)}
            
            for future in tqdm(as_completed(future_to_batch), total=len(future_to_batch), 
                             desc="Cross-folder comparison"):
                batch_results = future.result()
                results.extend(batch_results)
        
        # ✅ REVERSE COMPARISON: Optionally perform reverse direction
        if use_reverse_comparison and query_folder != folder1_path:
            print("🔄 Performing reverse comparison for completeness...")
            
            # Swap query and target
            reverse_query_folder = folder1_path
            reverse_target_folder = folder2_path
            reverse_query_images = folder1_images
            
            def process_reverse_batch(query_batch):
                batch_results = []
                
                for query_img in query_batch:
                    query_features = self.features_cache.get(query_img)
                    if not query_features:
                        continue
                    
                    combined_similarities = {}
                    
                    for feature_type in ['sift', 'vgg16', 'densenet121', 'googlenet']:
                        if feature_type in self.folder_indexes[reverse_target_folder]:
                            target_index_data = self.folder_indexes[reverse_target_folder][feature_type]
                            target_index = target_index_data['index']
                            target_paths = target_index_data['image_paths']
                            
                            query_vector = query_features[feature_type].reshape(1, -1).astype('float32')
                            query_norm = np.linalg.norm(query_vector)
                            if query_norm > 0:
                                query_vector = query_vector / query_norm
                            
                            scores, indices = target_index.search(query_vector, len(target_paths))
                            
                            for score, idx in zip(scores[0], indices[0]):
                                if 0 <= idx < len(target_paths):
                                    target_img = target_paths[idx]
                                    similarity_score = max(0, score * 100)
                                    
                                    if target_img not in combined_similarities:
                                        combined_similarities[target_img] = {}
                                    combined_similarities[target_img][feature_type] = similarity_score
                    
                    for target_img, feature_scores in combined_similarities.items():
                        final_score = sum(feature_scores.get(ft, 0) * self.weights[ft] 
                                        for ft in self.weights.keys())
                        
                        if final_score >= similarity_threshold:
                            # Check if this pair already exists (avoid duplicates)
                            existing = any(r['image1'] == query_img and r['image2'] == target_img 
                                         for r in results)
                            if not existing:
                                batch_results.append({
                                    'image1': query_img,
                                    'image2': target_img,
                                    'visual_score': final_score,
                                    'feature_breakdown': feature_scores,
                                    'comparison_direction': f"{reverse_query_folder} -> {reverse_target_folder}"
                                })
                
                return batch_results
            
            # Process reverse batches
            reverse_batches = [reverse_query_images[i:i + query_batch_size] 
                             for i in range(0, len(reverse_query_images), query_batch_size)]
            
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_batch = {executor.submit(process_reverse_batch, batch): i 
                                 for i, batch in enumerate(reverse_batches)}
                
                for future in tqdm(as_completed(future_to_batch), total=len(future_to_batch), 
                                 desc="Reverse comparison"):
                    batch_results = future.result()
                    results.extend(batch_results)
        
        # Sort by similarity score
        results.sort(key=lambda x: x['visual_score'], reverse=True)
        
        print(f"✅ Comparison complete!")
        print(f"   📊 Total comparisons processed: {len(query_images) * len(target_images)}")
        print(f"   🎯 High similarity matches found: {len(results)}")
        print(f"   📈 Average similarity: {np.mean([r['visual_score'] for r in results]):.2f}%" if results else "   📈 No matches found")
        
        return results

    # ✅ COMPATIBILITY: Keep original method for backward compatibility
    def calculate_visual_similarity(self, image_path1, image_path2):
        """✅ COMPATIBILITY: Original method maintained"""
        return self.calculate_visual_similarity_optimized(image_path1, image_path2)

    def get_folder_stats(self):
        """✅ NEW: Get statistics about folder preparation"""
        stats = {}
        for folder_path in self.folder_image_paths:
            folder_images = len(self.folder_image_paths[folder_path])
            folder_features = len(self.folder_features.get(folder_path, {}))
            folder_indexes = len(self.folder_indexes.get(folder_path, {}))
            
            stats[folder_path] = {
                'images': folder_images,
                'features': folder_features,
                'indexes': folder_indexes
            }
        
        return stats

    def cache_stats(self):
        """✅ ENHANCED: Display comprehensive cache statistics"""
        print(f"📊 Visual Cache Statistics:")
        print(f"   📄 Global feature cache: {len(self.features_cache)}")
        print(f"   📁 Folders prepared: {len(self.folder_indexes)}")
        
        for folder_path, stats in self.get_folder_stats().items():
            print(f"   📂 {folder_path}:")
            print(f"      Images: {stats['images']}")
            print(f"      Features: {stats['features']}")
            print(f"      Indexes: {stats['indexes']}")
        
        if self.bovw_kmeans:
            print(f"   🎯 BoVW clusters: {self.bovw_clusters}")

    def clear_cache(self):
        """✅ ENHANCED: Clear all caches"""
        self.features_cache = {}
        self.folder_indexes = {}
        self.folder_image_paths = {}
        self.folder_features = {}
        print("🗑️ All visual caches cleared")
