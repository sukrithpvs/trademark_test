
import re
from dataclasses import dataclass
import warnings
warnings.filterwarnings("ignore")

# Required: pip install phonetics nltk python-Levenshtein
try:
    import phonetics
    import nltk
    from Levenshtein import distance as levenshtein_distance, jaro_winkler

    nltk.download('cmudict', quiet=True)
    try:
        cmu_dict = nltk.corpus.cmudict.dict()
    except:
        cmu_dict = {}

except ImportError:
    print("Install: pip install phonetics nltk python-Levenshtein")
    cmu_dict = {}

    def soundex(word): return word[:4].ljust(4, '0')
    def metaphone(word): return word[:4]
    def dmetaphone(word): return (word[:4], '')
    def levenshtein_distance(a, b): return abs(len(a) - len(b))
    def jaro_winkler(a, b): return 1.0 if a == b else 0.0
    phonetics = type('obj', (object,), {
        'soundex': soundex, 'metaphone': metaphone, 'dmetaphone': dmetaphone
    })()

@dataclass
class SimilarityScore:
    phonetic: float
    visual: float
    overall: float

@dataclass
class AnalysisResult:
    scores: SimilarityScore
    risk_level: str
    analysis_notes: str = ""

class EnhancedTrademarkAnalyzer:
    """Enhanced trademark analyzer with distance penalty for partial matches"""

    def __init__(self):
        # Visual similarity mappings
        self.visual_map = {
            '0': 'o', '1': 'l', '3': 'e', '5': 's', '8': 'b',
            '4': 'a', '7': 't', '2': 'z', '9': 'g', '6': 'g'
        }
        # Add reverse mappings
        for k, v in list(self.visual_map.items()):
            self.visual_map[v] = k

        # Comprehensive stopwords and generic terms to ignore
        self.stopwords = {
            # Articles and determiners
            'the', 'a', 'an', 'this', 'that', 'these', 'those',
            
            # Prepositions
            'by', 'from', 'to', 'for', 'with', 'without', 'in', 'on', 'at', 'of', 'off',
            'up', 'down', 'over', 'under', 'through', 'between', 'among', 'during',
            'before', 'after', 'above', 'below', 'across', 'around', 'behind',
            
            # Pronouns
            'they', 'them', 'their', 'theirs', 'he', 'she', 'it', 'his', 'her', 'hers',
            'we', 'us', 'our', 'ours', 'you', 'your', 'yours', 'i', 'me', 'my', 'mine',
            
            # Conjunctions
            'and', 'or', 'but', 'so', 'yet', 'nor', 'as', 'if', 'when', 'where', 'while',
            
            # Common verbs
            'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
            'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
            'can', 'must', 'shall', 'get', 'got', 'make', 'made', 'take', 'took',
            
            # Common adverbs
            'very', 'really', 'quite', 'rather', 'too', 'also', 'just', 'only', 'even',
            'still', 'already', 'yet', 'again', 'once', 'twice', 'always', 'never',
            'often', 'sometimes', 'usually', 'frequently', 'rarely', 'seldom',
            
            # Generic business terms
            'company', 'corp', 'corporation', 'inc', 'incorporated', 'ltd', 'limited',
            'llc', 'llp', 'group', 'holdings', 'enterprises', 'solutions', 'systems',
            'technologies', 'tech', 'services', 'consulting', 'management', 'partners',
            'associates', 'foundation', 'trust', 'organization', 'institute', 'center',
            'centre', 'agency', 'bureau', 'department', 'division', 'unit', 'team',
            
            # Generic product terms
            'product', 'products', 'brand', 'brands', 'item', 'items', 'goods',
            'merchandise', 'equipment', 'equipments', 'device', 'devices', 'tool', 'tools',
            'machine', 'machines', 'system', 'software', 'hardware', 'application',
            'app', 'platform', 'network', 'online', 'digital', 'electronic',
            
            # Generic descriptive terms
            'new', 'old', 'fresh', 'original', 'classic', 'modern', 'traditional',
            'premium', 'deluxe', 'standard', 'basic', 'advanced', 'professional',
            'expert', 'master', 'super', 'ultra', 'mega', 'mini', 'micro', 'macro',
            'best', 'top', 'first', 'last', 'main', 'primary', 'secondary', 'extra',
            'special', 'unique', 'exclusive', 'custom', 'personal', 'private', 'public',
            'global', 'international', 'national', 'local', 'regional', 'universal',
            'general', 'specific', 'particular', 'individual', 'collective', 'common',
            'rare', 'popular', 'famous', 'known', 'unknown', 'hidden', 'secret',
            'open', 'closed', 'free', 'paid', 'cheap', 'expensive', 'affordable',
            'luxury', 'budget', 'economy', 'commercial', 'industrial', 'residential',
            
            # Generic nouns
            'life', 'world', 'earth', 'nature', 'environment', 'space', 'time',
            'place', 'location', 'area', 'region', 'zone', 'sector', 'field',
            'market', 'industry', 'business', 'trade', 'commerce', 'economy',
            'finance', 'money', 'cash', 'credit', 'bank', 'investment', 'fund',
            'capital', 'asset', 'property', 'estate', 'real', 'virtual', 'digital',
            'home', 'house', 'building', 'office', 'shop', 'store', 'mall',
            'center', 'hub', 'base', 'station', 'point', 'spot', 'site', 'web',
            'page', 'book', 'magazine', 'newspaper', 'journal', 'article', 'report',
            'study', 'research', 'analysis', 'review', 'survey', 'test', 'exam',
            'course', 'class', 'lesson', 'training', 'education', 'school', 'college',
            'university', 'institute', 'academy', 'workshop', 'seminar', 'conference',
            'meeting', 'event', 'show', 'exhibition', 'fair', 'festival', 'party',
            'celebration', 'ceremony', 'ritual', 'tradition', 'culture', 'art',
            'music', 'song', 'dance', 'movie', 'film', 'video', 'photo', 'picture',
            'image', 'graphic', 'design', 'style', 'fashion', 'trend', 'mode',
            'way', 'method', 'technique', 'approach', 'strategy', 'plan', 'project',
            'program', 'scheme', 'initiative', 'campaign', 'mission', 'vision',
            'goal', 'target', 'objective', 'purpose', 'reason', 'cause', 'effect',
            'result', 'outcome', 'consequence', 'impact', 'influence', 'power',
            'force', 'energy', 'strength', 'speed', 'rate', 'level', 'degree',
            'amount', 'quantity', 'number', 'count', 'total', 'sum', 'average',
            'maximum', 'minimum', 'limit', 'range', 'scale', 'size', 'length',
            'width', 'height', 'depth', 'weight', 'mass', 'volume', 'capacity',
            'space', 'room', 'area', 'surface', 'edge', 'corner', 'side', 'part',
            'piece', 'section', 'portion', 'share', 'percentage', 'ratio', 'rate','Hotel',
            'restaurant', 'cafe', 'bar', 'pub', 'club', 'lounge', 'venue','Hotels','Restaurants',
            'Cafes', 'Bars', 'Pubs', 'Clubs', 'Lounges', 'Venues','Resort', 'resorts', 'spa','spas','quality',
            
            # Food and beverage terms
            'food', 'drink', 'beverage', 'meal', 'breakfast', 'lunch', 'dinner',
            'snack', 'dessert', 'fruit', 'vegetable', 'meat', 'fish', 'chicken',
            'beef', 'pork', 'lamb', 'rice', 'bread', 'pasta', 'noodles', 'soup',
            'salad', 'sandwich', 'pizza', 'burger', 'cake', 'cookie', 'chocolate',
            'candy', 'sugar', 'salt', 'pepper', 'spice', 'herb', 'oil', 'butter',
            'cheese', 'milk', 'cream', 'yogurt', 'ice', 'water', 'juice', 'coffee',
            'tea', 'wine', 'beer', 'alcohol', 'tomato', 'potato', 'onion', 'garlic',
            'apple', 'orange', 'banana', 'grape', 'strawberry', 'lemon', 'lime',
            
            # Transportation terms
            'car', 'auto', 'vehicle', 'truck', 'bus', 'train', 'plane', 'ship',
            'boat', 'bicycle', 'bike', 'motorcycle', 'scooter', 'taxi', 'cab',
            'transport', 'transportation', 'travel', 'journey', 'trip', 'tour',
            'flight', 'drive', 'ride', 'walk', 'run', 'move', 'motion', 'speed',
            
            # Technology terms
            'computer', 'laptop', 'desktop', 'tablet', 'phone', 'smartphone',
            'mobile', 'device', 'gadget', 'internet', 'web', 'website', 'site',
            'email', 'message', 'text', 'call', 'video', 'audio', 'data',
            'information', 'database', 'server', 'cloud', 'storage', 'memory',
            'processor', 'cpu', 'gpu', 'ram', 'disk', 'drive', 'usb', 'cable',
            'wireless', 'bluetooth', 'wifi', 'network', 'connection', 'link',
            
            # Health and wellness terms
            'health', 'medical', 'medicine', 'doctor', 'hospital', 'clinic',
            'pharmacy', 'drug', 'pill', 'tablet', 'capsule', 'treatment',
            'therapy', 'care', 'wellness', 'fitness', 'exercise', 'gym',
            'sport', 'game', 'play', 'fun', 'entertainment', 'hobby', 'leisure',
            
            # Clothing and fashion terms
            'clothing', 'clothes', 'dress', 'shirt', 'pants', 'shoes', 'hat',
            'jacket', 'coat', 'sweater', 'jeans', 'skirt', 'suit', 'tie',
            'belt', 'bag', 'purse', 'wallet', 'watch', 'jewelry', 'ring',
            'necklace', 'bracelet', 'earring', 'fashion', 'style', 'trend',
            
            # Colors
            'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
            'brown', 'black', 'white', 'gray', 'grey', 'silver', 'gold',
            'color', 'colour', 'bright', 'dark', 'light', 'pale', 'deep',
            
            # Numbers and quantities
            'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
            'nine', 'ten', 'hundred', 'thousand', 'million', 'billion',
            'first', 'second', 'third', 'fourth', 'fifth', 'single', 'double',
            'triple', 'multiple', 'many', 'few', 'several', 'some', 'all',
            'every', 'each', 'any', 'no', 'none', 'zero', 'null', 'empty',
            'full', 'half', 'quarter', 'whole', 'complete', 'partial',
            
            # Time-related terms
            'time', 'day', 'night', 'morning', 'afternoon', 'evening', 'hour',
            'minute', 'second', 'week', 'month', 'year', 'today', 'tomorrow',
            'yesterday', 'now', 'then', 'soon', 'late', 'early', 'quick',
            'fast', 'slow', 'speed', 'rapid', 'instant', 'immediate', 'delay',
            'wait', 'pause', 'stop', 'start', 'begin', 'end', 'finish',
            'continue', 'proceed', 'advance', 'progress', 'develop', 'grow','plus',
            'increase', 'decrease', 'rise', 'fall', 'up', 'down', 'high', 'low'
        }

        # Get comprehensive phonetic patterns
        self.phonetic_patterns = self._get_phonetic_sound_patterns()

    def _get_phonetic_sound_patterns(self):
        """Comprehensive phonetic sound patterns for similarity detection"""
        return [
            # VOWEL SOUND PATTERNS
            ('ai', 'ay'), ('ay', 'ai'),           # wait/wayt, say/sai
            ('ei', 'ay'), ('ay', 'ei'),           # eight/ayt, weigh/way
            ('ey', 'ay'), ('ay', 'ey'),           # they/thay, grey/gray
            ('ee', 'ea'), ('ea', 'ee'),           # see/sea, meet/meat
            ('ie', 'ee'), ('ee', 'ie'),           # piece/pees, believe/beleev
            ('oa', 'ow'), ('ow', 'oa'),           # boat/bowt, know/noa
            ('oo', 'u'), ('u', 'oo'),             # book/buk, look/luk
            ('ou', 'ow'), ('ow', 'ou'),           # house/hows, cow/cou
            ('ue', 'oo'), ('oo', 'ue'),           # blue/bloo, true/troo
            ('ew', 'oo'), ('oo', 'ew'),           # new/noo, grew/groo
            ('au', 'aw'), ('aw', 'au'),           # caught/cawt, law/lau
            ('oi', 'oy'), ('oy', 'oi'),           # coin/coyn, boy/boi

            # CONSONANT SOUND PATTERNS - PH/F FAMILY
            ('ph', 'f'), ('f', 'ph'),             # phone/fone, graph/graf
            ('phen', 'fen'), ('fen', 'phen'),     # phenomenon/fenomenon
            ('phil', 'fil'), ('fil', 'phil'),     # philosophy/filosofy
            ('phon', 'fon'), ('fon', 'phon'),     # telephone/telefone
            ('phys', 'fis'), ('fis', 'phys'),     # physics/fisics
            ('pharm', 'farm'), ('farm', 'pharm'), # pharmacy/farmacy
            ('photo', 'foto'), ('foto', 'photo'), # photograph/fotograf

            # CONSONANT SOUND PATTERNS - C/K/CK FAMILY
            ('ck', 'k'), ('k', 'ck'),             # back/bak, quick/quik
            ('c', 'k'), ('k', 'c'),               # cat/kat, cool/kool
            ('ch', 'k'), ('k', 'ch'),             # school/skool, echo/eko
            ('que', 'k'), ('k', 'que'),           # unique/unik, technique/teknik
            ('qu', 'kw'), ('kw', 'qu'),           # queen/kween, quick/kwik
            ('chr', 'kr'), ('kr', 'chr'),         # chrome/krome, chronic/kronik
            ('sch', 'sk'), ('sk', 'sch'),         # schedule/skedule

            # CONSONANT SOUND PATTERNS - GH FAMILY
            ('ough', 'uff'), ('uff', 'ough'),     # tough/tuff, rough/ruff
            ('ough', 'u'), ('u', 'ough'),         # through/thru, although/althou
            ('ough', 'o'), ('o', 'ough'),         # dough/do, though/tho
            ('ough', 'aw'), ('aw', 'ough'),       # bought/bawt, fought/fawt
            ('augh', 'af'), ('af', 'augh'),       # laugh/laf, draft/draught
            ('ight', 'ite'), ('ite', 'ight'),     # night/nite, light/lite
            ('ight', 'yt'), ('yt', 'ight'),       # bright/bryt, sight/syt
            ('eigh', 'ay'), ('ay', 'eigh'),       # weight/wayt, freight/frayt
            ('gh', ''), ('', 'gh'),               # might/mite, sight/site

            # CONSONANT SOUND PATTERNS - TH FAMILY
            ('th', 'f'), ('f', 'th'),             # with/wif, math/maf
            ('th', 'd'), ('d', 'th'),             # the/de, that/dat
            ('th', 't'), ('t', 'th'),             # thing/ting, think/tink

            # CONSONANT SOUND PATTERNS - S/Z FAMILY
            ('s', 'z'), ('z', 's'),               # house/houze, realize/realise
            ('se', 'ze'), ('ze', 'se'),           # please/pleze, freeze/freese
            ('ss', 's'), ('s', 'ss'),             # class/clas, stress/stres
            ('sc', 's'), ('s', 'sc'),             # scene/sene, science/sience
            ('ps', 's'), ('s', 'ps'),             # psychology/sychology

            # CONSONANT SOUND PATTERNS - X FAMILY
            ('x', 'ks'), ('ks', 'x'),             # box/boks, six/siks
            ('x', 'gz'), ('gz', 'x'),             # exact/egzact, exam/egzam
            ('ex', 'eks'), ('eks', 'ex'),         # express/ekspress
            ('exc', 'eks'), ('eks', 'exc'),       # excite/eksite

            # CONSONANT SOUND PATTERNS - SILENT LETTERS
            ('kn', 'n'), ('n', 'kn'),             # know/now, knee/nee
            ('wr', 'r'), ('r', 'wr'),             # write/rite, wrong/rong
            ('mb', 'm'), ('m', 'mb'),             # thumb/thum, lamb/lam
            ('bt', 't'), ('t', 'bt'),             # debt/det, doubt/dout
            ('lf', 'f'), ('f', 'lf'),             # half/haf, calf/caf
            ('lm', 'm'), ('m', 'lm'),             # palm/pam, calm/cam
            ('st', 's'), ('s', 'st'),             # listen/lisen, castle/casle
            ('sw', 's'), ('s', 'sw'),             # sword/sord, answer/anser

            # DOUBLE CONSONANT PATTERNS
            ('ll', 'l'), ('l', 'll'),             # all/al, ball/bal
            ('tt', 't'), ('t', 'tt'),             # better/beter, letter/leter
            ('nn', 'n'), ('n', 'nn'),             # dinner/diner, winner/winer
            ('rr', 'r'), ('r', 'rr'),             # error/eror, mirror/miror
            ('pp', 'p'), ('p', 'pp'),             # happy/hapy, pepper/peper
            ('dd', 'd'), ('d', 'dd'),             # ladder/lader, hidden/hiden
            ('gg', 'g'), ('g', 'gg'),             # bigger/biger, dagger/dager
            ('bb', 'b'), ('b', 'bb'),             # rabbit/rabit, hobby/hoby
            ('ff', 'f'), ('f', 'ff'),             # coffee/cofe, stuff/stuf
            ('ss', 's'), ('s', 'ss'),             # guess/gues, class/clas
            ('zz', 'z'), ('z', 'zz'),             # buzz/buz, jazz/jaz
            ('mm', 'm'), ('m', 'mm'),             # hammer/hamer, summer/sumer

            # WORD ENDING PATTERNS
            ('tion', 'shun'), ('shun', 'tion'),   # nation/nashun, action/akshun
            ('sion', 'shun'), ('shun', 'sion'),   # mission/mishun, vision/vishun
            ('cial', 'shal'), ('shal', 'cial'),   # special/speshal, social/soshal
            ('tial', 'shal'), ('shal', 'tial'),   # partial/parshal, martial/marshal
            ('ous', 'us'), ('us', 'ous'),         # famous/famus, serious/serius
            ('eous', 'eus'), ('eus', 'eous'),     # gorgeous/gorgeus, righteous/righteus
            ('ious', 'ius'), ('ius', 'ious'),     # curious/curius, serious/serius
            ('eous', 'ous'), ('ous', 'eous'),     # gorgeous/gorgous
            ('ful', 'ful'), ('full', 'ful'),      # beautiful/beatiful, wonderful/wonderfl
            ('ness', 'nes'), ('nes', 'ness'),     # darkness/darknes, happiness/happines
            ('ment', 'ment'), ('mnt', 'ment'),    # moment/momnt, payment/paymnt
            ('able', 'abel'), ('abel', 'able'),   # table/tabel, comfortable/comfortabel
            ('ible', 'ibel'), ('ibel', 'ible'),   # terrible/terribel, possible/possibel

            # COMMON SPELLING VARIATIONS
            ('er', 're'), ('re', 'er'),           # center/centre, theater/theatre
            ('or', 'our'), ('our', 'or'),         # color/colour, honor/honour
            ('ize', 'ise'), ('ise', 'ize'),       # realize/realise, organize/organise
            ('ized', 'ised'), ('ised', 'ized'),   # realized/realised, organized/organised
            ('izing', 'ising'), ('ising', 'izing'), # realizing/realising
            ('ization', 'isation'), ('isation', 'ization'), # organization/organisation
            ('yze', 'yse'), ('yse', 'yze'),       # analyze/analyse, paralyze/paralyse
            ('og', 'ogue'), ('ogue', 'og'),       # dialog/dialogue, catalog/catalogue

            # COMMON CONSONANT SUBSTITUTIONS
            ('v', 'w'), ('w', 'v'),               # love/luv, have/hav
            ('j', 'g'), ('g', 'j'),               # judge/gudge, gem/jem
            ('y', 'i'), ('i', 'y'),               # my/mi, city/cyty
            ('d', 't'), ('t', 'd'),               # and/ant, hand/hant
            ('b', 'p'), ('p', 'b'),               # cab/cap, robe/rope
            ('g', 'k'), ('k', 'g'),               # big/bik, dog/dok
            ('r', 'l'), ('l', 'r'),               # very/vely, girl/gril

            # VOWEL LETTER SUBSTITUTIONS
            ('a', 'e'), ('e', 'a'),               # any/eny, many/meny
            ('e', 'i'), ('i', 'e'),               # pretty/pritty, women/wimin
            ('i', 'y'), ('y', 'i'),               # which/whych, city/citi
            ('o', 'u'), ('u', 'o'),               # come/cum, some/sum
            ('a', 'o'), ('o', 'a'),               # want/wont, was/wos

            # INTERNET/TEXT SPEAK PATTERNS
            ('ould', 'ud'), ('ud', 'ould'),       # would/wud, could/cud, should/shud
            ('ood', 'ud'), ('ud', 'ood'),         # good/gud, hood/hud
            ('ove', 'uv'), ('uv', 'ove'),         # love/luv, above/abuv
            ('ome', 'um'), ('um', 'ome'),         # come/cum, some/sum
            ('ause', 'uz'), ('uz', 'ause'),       # because/becuz, cause/cuz
            ('ease', 'eez'), ('eez', 'ease'),     # please/pleez, tease/teez
        ]

    def _filter_stopwords(self, text: str) -> str:
        """Remove stopwords and generic terms from text"""
        words = re.findall(r'\b\w+\b', text.lower())
        filtered_words = [word for word in words if word not in self.stopwords]
        return ' '.join(filtered_words) if filtered_words else text.lower()

    def _check_exact_client_match(self, client_words: list, journal_words: list) -> tuple:
        """Check if all client words appear in journal text - returns (is_exact_match, match_ratio)"""
        if not client_words:
            return False, 0.0
        
        client_set = set(word.lower() for word in client_words)
        journal_set = set(word.lower() for word in journal_words)
        
        matches = client_set.intersection(journal_set)
        match_ratio = len(matches) / len(client_set)
        
        # True exact match only if ALL client words are found
        is_exact_match = client_set.issubset(journal_set)
        
        return is_exact_match, match_ratio

    def _calculate_distance_penalty(self, client_words: list, journal_words: list, match_ratio: float) -> float:
        """Calculate distance penalty for partial word matches"""
        if match_ratio == 1.0:  # All words match - no penalty
            return 0.0
        
        if match_ratio == 0.0:  # No words match - no penalty needed
            return 0.0
        
        # Filter out generic terms for penalty calculation
        client_meaningful = [word for word in client_words if word.lower() not in self.stopwords]
        journal_meaningful = [word for word in journal_words if word.lower() not in self.stopwords]
        
        if not client_meaningful:  # Only generic terms - high penalty
            return 0.6
        
        # Calculate meaningful word match ratio
        client_meaningful_set = set(word.lower() for word in client_meaningful)
        journal_meaningful_set = set(word.lower() for word in journal_meaningful)
        meaningful_matches = client_meaningful_set.intersection(journal_meaningful_set)
        meaningful_match_ratio = len(meaningful_matches) / len(client_meaningful_set) if client_meaningful_set else 0.0
        
        # Distance penalty based on meaningful word coverage
        if meaningful_match_ratio >= 0.8:  # 80%+ meaningful words match
            penalty = 0.1  # Light penalty
        elif meaningful_match_ratio >= 0.6:  # 60-79% meaningful words match
            penalty = 0.2  # Moderate penalty
        elif meaningful_match_ratio >= 0.4:  # 40-59% meaningful words match
            penalty = 0.3  # Higher penalty
        elif meaningful_match_ratio >= 0.2:  # 20-39% meaningful words match
            penalty = 0.4  # High penalty
        else:  # <20% meaningful words match
            penalty = 0.5  # Very high penalty
        
        return penalty

    def _check_word_interchange(self, client_words: list, journal_words: list) -> bool:
        """Check if words are just interchanged between client and journal"""
        if not client_words or not journal_words:
            return False
            
        client_set = set(word.lower() for word in client_words)
        journal_set = set(word.lower() for word in journal_words)
        return client_set == journal_set and len(client_set) > 1

    def analyze(self, client: str, journal: str) -> AnalysisResult:
        """Enhanced analysis with distance penalty for partial matches"""
        # Input validation
        client = client.strip()
        journal = journal.strip()
        
        # Handle empty or invalid inputs
        if not client or not journal:
            return AnalysisResult(
                SimilarityScore(0.0, 0.0, 0.0),
                "INVALID INPUT",
                "Empty or invalid input provided"
            )
        
        # Check for meaningful alphanumeric content
        if not re.search(r'\w', client) or not re.search(r'\w', journal):
            return AnalysisResult(
                SimilarityScore(0.0, 0.0, 0.0),
                "INVALID INPUT",
                "No meaningful text content found"
            )
        
        # Extract words before filtering
        client_words = re.findall(r'\b\w+\b', client)
        journal_words = re.findall(r'\b\w+\b', journal)
        
        # Additional validation - check if all words are filtered out
        if not client_words or not journal_words:
            return AnalysisResult(
                SimilarityScore(0.0, 0.0, 0.0),
                "INVALID INPUT",
                "No valid words found in input"
            )
        
        # Filter stopwords for main analysis
        filtered_client = self._filter_stopwords(client)
        filtered_journal = self._filter_stopwords(journal)
        
        # Check if filtering removed all meaningful content
        if not filtered_client.strip() or not filtered_journal.strip():
            return AnalysisResult(
                SimilarityScore(0.0, 0.0, 0.0),
                "MINIMAL RISK",
                "Only common words and generic terms found"
            )
        
        analysis_notes = []
        
        # Check for exact and partial matches
        is_exact_match, match_ratio = self._check_exact_client_match(client_words, journal_words)
        
        # Special Case 1: TRUE exact match (all client words found)
        if is_exact_match:
            analysis_notes.append("Exact client trademark found in journal text")
            return AnalysisResult(
                SimilarityScore(1.0, 1.0, 1.0),
                "VERY HIGH RISK - EXACT MATCH",
                "; ".join(analysis_notes)
            )
        
        # Special Case 2: Check for word interchange (only if all words match)
        if match_ratio == 1.0 and self._check_word_interchange(client_words, journal_words):
            analysis_notes.append("Words interchanged between client and journal")
            return AnalysisResult(
                SimilarityScore(1.0, 1.0, 1.0),
                "VERY HIGH RISK - WORD INTERCHANGE",
                "; ".join(analysis_notes)
            )
        
        # Special Case 3: Partial word matches with distance penalty
        if match_ratio > 0:
            analysis_notes.append(f"Partial word match: {match_ratio:.1%} of client words found in journal")
            
            # Calculate distance penalty
            distance_penalty = self._calculate_distance_penalty(client_words, journal_words, match_ratio)
            
            if distance_penalty > 0:
                analysis_notes.append(f"Distance penalty applied: -{distance_penalty:.2f} for partial word positioning")
        
        # Perform regular analysis on filtered text
        phonetic_score = self._pure_phonetic_similarity(filtered_client, filtered_journal)
        visual_score = self._pure_visual_similarity(filtered_client, filtered_journal)
        
        # Weighted combination
        overall_score = phonetic_score * 0.7 + visual_score * 0.3
        
        # Apply partial word match boost
        if match_ratio >= 0.5:  # 50% or more of client words found
            boost = 0.6 * match_ratio
            overall_score = min(1.0, overall_score + boost)
            analysis_notes.append(f"Score boosted by {boost:.2f} for {match_ratio:.1%} word matches")
        elif match_ratio > 0:  # Some client words found
            boost = 0.4 * match_ratio
            overall_score = min(1.0, overall_score + boost)
            analysis_notes.append(f"Score boosted by {boost:.2f} for partial word matches")
        
        # Apply distance penalty (only for partial matches)
        if match_ratio > 0 and match_ratio < 1.0:
            distance_penalty = self._calculate_distance_penalty(client_words, journal_words, match_ratio)
            overall_score = max(0.0, overall_score - distance_penalty)
        
        # Smart boosting for genuine equivalents
        if self._has_direct_pattern_match(filtered_client, filtered_journal):
            overall_score = min(1.0, overall_score + 0.30)
            analysis_notes.append("Phonetic pattern match detected")
        elif self._is_visual_number_substitution(filtered_client, filtered_journal):
            overall_score = min(1.0, overall_score + 0.25)
            analysis_notes.append("Visual number substitution detected")
        
        # Edit distance penalty for very different words
        if self._are_edit_distance_very_different(filtered_client, filtered_journal):
            if match_ratio >= 0.5:
                penalty_factor = 0.7  # Reduced penalty
                analysis_notes.append("Reduced edit distance penalty due to significant word overlap")
            else:
                penalty_factor = 0.5  # Original penalty
                analysis_notes.append("Edit distance penalty applied")
            
            overall_score *= penalty_factor
        
        # Note if stopwords were filtered
        if len(client_words) > len(filtered_client.split()) or len(journal_words) > len(filtered_journal.split()):
            analysis_notes.append("Common words and generic terms filtered out")
        
        risk_level = self._determine_risk(overall_score)
        
        return AnalysisResult(
            SimilarityScore(phonetic_score, visual_score, overall_score),
            risk_level,
            "; ".join(analysis_notes) if analysis_notes else ""
        )

    def _pure_phonetic_similarity(self, word1: str, word2: str) -> float:
        """Pure phonetic similarity with improved Soundex handling"""
        w1 = re.sub(r'[^a-zA-Z\s]', '', word1.lower()).strip()
        w2 = re.sub(r'[^a-zA-Z\s]', '', word2.lower()).strip()

        if not w1 or not w2:
            return 0.0
        if w1 == w2:
            return 1.0

        # Handle multi-word cases
        if ' ' in w1 or ' ' in w2:
            return self._multiword_phonetic_similarity(w1, w2)

        similarities = []

        # 1. Direct phonetic pattern matching (highest priority)
        pattern_sim = self._pattern_transformation_similarity(w1, w2)
        similarities.append(pattern_sim)

        # 2. Soundex comparison with validation
        try:
            s1, s2 = phonetics.soundex(w1), phonetics.soundex(w2)
            if s1 == s2 and s1 != "0000":
                # Validate Soundex match with edit distance
                edit_sim = 1.0 - (levenshtein_distance(w1, w2) / max(len(w1), len(w2)))
                if edit_sim > 0.4:  # Only trust Soundex if words are somewhat similar
                    similarities.append(0.60)
                else:
                    similarities.append(0.20)  # Low confidence for false Soundex matches
            else:
                similarities.append(0.0)
        except:
            similarities.append(0.0)

        # 3. Metaphone comparison - more conservative
        try:
            m1, m2 = phonetics.metaphone(w1), phonetics.metaphone(w2)
            if m1 == m2 and m1:
                # Validate Metaphone match
                edit_sim = 1.0 - (levenshtein_distance(w1, w2) / max(len(w1), len(w2)))
                if edit_sim > 0.3:
                    similarities.append(0.65)
                else:
                    similarities.append(0.25)  # Low confidence
            else:
                similarities.append(0.0)
        except:
            similarities.append(0.0)

        # 4. Double Metaphone comparison
        try:
            dm1 = phonetics.dmetaphone(w1)
            dm2 = phonetics.dmetaphone(w2)
            if ((dm1[0] == dm2[0] and dm1[0]) or
                (dm1[1] and dm2[1] and dm1[1] == dm2[1])):
                # Validate Double Metaphone match
                edit_sim = 1.0 - (levenshtein_distance(w1, w2) / max(len(w1), len(w2)))
                if edit_sim > 0.3:
                    similarities.append(0.70)
                else:
                    similarities.append(0.30)  # Low confidence
            else:
                similarities.append(0.0)
        except:
            similarities.append(0.0)

        # 5. CMU pronunciation similarity
        if cmu_dict:
            cmu_sim = self._enhanced_cmu_similarity(w1, w2)
            similarities.append(cmu_sim)

        # 6. Enhanced vowel/consonant analysis
        vowel_sim = self._enhanced_vowel_similarity(w1, w2)
        consonant_sim = self._enhanced_consonant_similarity(w1, w2)
        similarities.extend([vowel_sim, consonant_sim])

        # 7. Smart edit distance
        edit_sim = self._smart_edit_similarity(w1, w2)
        similarities.append(edit_sim)

        # Use weighted average instead of maximum
        if similarities:
            # Sort and take top 3 scores
            top_scores = sorted(similarities, reverse=True)[:3]
            if len(top_scores) >= 2:
                # Weighted average of top scores
                final_score = (top_scores[0] * 0.5 + top_scores[1] * 0.3 + 
                              (top_scores[2] if len(top_scores) > 2 else 0) * 0.2)
                return final_score
            else:
                return top_scores[0] if top_scores else 0.0
        else:
            return 0.0

    def _pattern_transformation_similarity(self, word1: str, word2: str) -> float:
        """Pattern-based transformation similarity"""
        max_similarity = 0.0

        # Try all phonetic patterns
        for old, new in self.phonetic_patterns:
            # Transform word1 -> word2
            if old in word1:
                transformed = word1.replace(old, new)
                if transformed == word2:
                    return 0.98
                # Check partial similarity after transformation
                if len(transformed) > 0 and len(word2) > 0:
                    max_len = max(len(transformed), len(word2))
                    edit_dist = levenshtein_distance(transformed, word2)
                    similarity = 1.0 - (edit_dist / max_len)
                    if similarity >= 0.9:
                        max_similarity = max(max_similarity, 0.95)
                    elif similarity >= 0.8:
                        max_similarity = max(max_similarity, 0.90)
                    elif similarity >= 0.7:
                        max_similarity = max(max_similarity, 0.80)

            # Transform word2 -> word1
            if old in word2:
                transformed = word2.replace(old, new)
                if transformed == word1:
                    return 0.98
                # Check partial similarity after transformation
                if len(transformed) > 0 and len(word1) > 0:
                    max_len = max(len(transformed), len(word1))
                    edit_dist = levenshtein_distance(transformed, word1)
                    similarity = 1.0 - (edit_dist / max_len)
                    if similarity >= 0.9:
                        max_similarity = max(max_similarity, 0.95)
                    elif similarity >= 0.8:
                        max_similarity = max(max_similarity, 0.90)
                    elif similarity >= 0.7:
                        max_similarity = max(max_similarity, 0.80)

        return max_similarity

    def _multiword_phonetic_similarity(self, phrase1: str, phrase2: str) -> float:
        """Multi-word phonetic similarity"""
        words1 = phrase1.split()
        words2 = phrase2.split()

        if not words1 or not words2:
            return 0.0

        # If one phrase contains all words of the other
        if all(word in words2 for word in words1):
            return 0.95
        if all(word in words1 for word in words2):
            return 0.95

        # Best word matching
        similarities = []
        for w1 in words1:
            word_sims = []
            for w2 in words2:
                sim = self._single_word_phonetic_similarity(w1, w2)
                word_sims.append(sim)
            if word_sims:
                similarities.append(max(word_sims))

        return sum(similarities) / len(similarities) if similarities else 0.0

    def _single_word_phonetic_similarity(self, word1: str, word2: str) -> float:
        """Single word phonetic similarity"""
        if word1 == word2:
            return 1.0

        # Pattern matching first
        pattern_sim = self._pattern_transformation_similarity(word1, word2)
        if pattern_sim > 0.5:
            return pattern_sim

        similarities = []

        # Soundex with validation
        try:
            s1, s2 = phonetics.soundex(word1), phonetics.soundex(word2)
            if s1 == s2 and s1 != "0000":
                edit_sim = 1.0 - (levenshtein_distance(word1, word2) / max(len(word1), len(word2)))
                if edit_sim > 0.4:
                    similarities.append(0.60)
                else:
                    similarities.append(0.20)
            else:
                similarities.append(0.0)
        except:
            similarities.append(0.0)

        # Metaphone with validation
        try:
            m1, m2 = phonetics.metaphone(word1), phonetics.metaphone(word2)
            if m1 == m2 and m1:
                edit_sim = 1.0 - (levenshtein_distance(word1, word2) / max(len(word1), len(word2)))
                if edit_sim > 0.3:
                    similarities.append(0.65)
                else:
                    similarities.append(0.25)
            else:
                similarities.append(0.0)
        except:
            similarities.append(0.0)

        # Edit distance
        max_len = max(len(word1), len(word2))
        edit_dist = levenshtein_distance(word1, word2)
        edit_sim = 1.0 - (edit_dist / max_len) if max_len > 0 else 0.0

        if edit_sim >= 0.9:
            similarities.append(0.90)
        elif edit_sim >= 0.8:
            similarities.append(0.80)
        elif edit_sim >= 0.7:
            similarities.append(0.65)
        elif edit_sim >= 0.6:
            similarities.append(0.45)
        else:
            similarities.append(edit_sim * 0.5)

        # Use weighted average of top scores
        if similarities:
            top_scores = sorted(similarities, reverse=True)[:2]
            if len(top_scores) >= 2:
                return top_scores[0] * 0.6 + top_scores[1] * 0.4
            else:
                return top_scores[0]
        else:
            return 0.0

    def _enhanced_cmu_similarity(self, word1: str, word2: str) -> float:
        """Enhanced CMU pronunciation similarity"""
        try:
            pron1 = cmu_dict.get(word1, [])
            pron2 = cmu_dict.get(word2, [])

            if not pron1 or not pron2:
                return 0.0

            # Compare pronunciations
            p1 = ''.join(re.sub(r'\d', '', phone) for phone in pron1[0])
            p2 = ''.join(re.sub(r'\d', '', phone) for phone in pron2[0])

            if p1 == p2:
                return 1.0

            # Phoneme similarity
            max_len = max(len(p1), len(p2), 1)
            edit_dist = levenshtein_distance(p1, p2)
            similarity = 1.0 - (edit_dist / max_len)

            if similarity >= 0.9:
                return 0.95
            elif similarity >= 0.8:
                return 0.90
            elif similarity >= 0.7:
                return 0.80
            elif similarity >= 0.6:
                return 0.65
            else:
                return similarity * 0.6
        except:
            return 0.0

    def _enhanced_vowel_similarity(self, word1: str, word2: str) -> float:
        """Enhanced vowel pattern similarity"""
        vowels1 = re.sub(r'[^aeiou]', '', word1)
        vowels2 = re.sub(r'[^aeiou]', '', word2)

        if not vowels1 or not vowels2:
            return 0.0
        if vowels1 == vowels2:
            return 0.85

        # Edit distance
        max_len = max(len(vowels1), len(vowels2))
        edit_dist = levenshtein_distance(vowels1, vowels2)
        similarity = 1.0 - (edit_dist / max_len) if max_len > 0 else 0.0

        return similarity * 0.7

    def _enhanced_consonant_similarity(self, word1: str, word2: str) -> float:
        """Enhanced consonant pattern similarity"""
        consonants1 = re.sub(r'[aeiou]', '', word1)
        consonants2 = re.sub(r'[aeiou]', '', word2)

        if not consonants1 or not consonants2:
            return 0.0
        if consonants1 == consonants2:
            return 0.85

        # Edit distance
        max_len = max(len(consonants1), len(consonants2))
        edit_dist = levenshtein_distance(consonants1, consonants2)
        similarity = 1.0 - (edit_dist / max_len) if max_len > 0 else 0.0

        return similarity * 0.7

    def _smart_edit_similarity(self, word1: str, word2: str) -> float:
        """Smart edit distance"""
        if not word1 or not word2:
            return 0.0

        max_len = max(len(word1), len(word2))
        edit_dist = levenshtein_distance(word1, word2)

        if max_len == 0:
            return 0.0

        similarity = 1.0 - (edit_dist / max_len)

        if similarity >= 0.95:
            return 0.95
        elif similarity >= 0.85:
            return 0.85
        elif similarity >= 0.75:
            return 0.75
        elif similarity >= 0.6:
            return 0.60
        else:
            return similarity * 0.6

    def _has_direct_pattern_match(self, word1: str, word2: str) -> bool:
        """Check for direct pattern matches"""
        w1 = re.sub(r'[^a-zA-Z]', '', word1.lower())
        w2 = re.sub(r'[^a-zA-Z]', '', word2.lower())

        # Check if any pattern transforms one word into the other
        for old, new in self.phonetic_patterns:
            if old in w1 and w1.replace(old, new) == w2:
                return True
            if old in w2 and w2.replace(old, new) == w1:
                return True

        return False
    
    def _is_visual_number_substitution(self, word1: str, word2: str) -> bool:
        """Check for visual number substitutions"""
        # Remove numbers and compare
        alpha1 = re.sub(r'[^a-zA-Z]', '', word1.lower())
        alpha2 = re.sub(r'[^a-zA-Z]', '', word2.lower())

        return alpha1 == alpha2 and alpha1 and len(alpha1) >= 2

    def _are_edit_distance_very_different(self, word1: str, word2: str) -> bool:
        """Check if words are very different by edit distance"""
        w1 = re.sub(r'[^a-zA-Z]', '', word1.lower())
        w2 = re.sub(r'[^a-zA-Z]', '', word2.lower())

        if not w1 or not w2:
            return True

        max_len = max(len(w1), len(w2))
        edit_dist = levenshtein_distance(w1, w2)
        edit_ratio = edit_dist / max_len if max_len > 0 else 1.0

        return edit_ratio > 0.7

    def _pure_visual_similarity(self, word1: str, word2: str) -> float:
        """Pure visual similarity"""
        w1, w2 = word1.lower(), word2.lower()

        if w1 == w2:
            return 1.0

        # Handle multi-word cases
        if ' ' in w1 or ' ' in w2:
            return self._multiword_visual_similarity(w1, w2)

        return self._single_word_visual_similarity(w1, w2)

    def _multiword_visual_similarity(self, phrase1: str, phrase2: str) -> float:
        """Multi-word visual similarity"""
        # Remove spaces and compare
        clean1 = phrase1.replace(' ', '')
        clean2 = phrase2.replace(' ', '')

        single_sim = self._single_word_visual_similarity(clean1, clean2)

        # Word by word comparison
        words1 = phrase1.split()
        words2 = phrase2.split()

        if words1 and words2:
            word_similarities = []
            for w1 in words1:
                word_sims = []
                for w2 in words2:
                    sim = self._single_word_visual_similarity(w1, w2)
                    word_sims.append(sim)
                if word_sims:
                    word_similarities.append(max(word_sims))

            word_avg = sum(word_similarities) / len(word_similarities) if word_similarities else 0.0
            return max(single_sim, word_avg)

        return single_sim

    def _single_word_visual_similarity(self, word1: str, word2: str) -> float:
        """Single word visual similarity"""
        # Number substitution check - high boost
        alpha1 = re.sub(r'[^a-zA-Z]', '', word1)
        alpha2 = re.sub(r'[^a-zA-Z]', '', word2)

        if alpha1 == alpha2 and alpha1 and len(alpha1) >= 2:
            return 0.95

        # Character-by-character similarity
        if len(word1) == len(word2):
            total_similarity = 0.0
            for c1, c2 in zip(word1, word2):
                if c1 == c2:
                    total_similarity += 1.0
                elif self.visual_map.get(c1) == c2 or self.visual_map.get(c2) == c1:
                    total_similarity += 0.8

            return total_similarity / len(word1)

        # Jaro-Winkler for different lengths
        return jaro_winkler(word1, word2) * 0.8

    def _determine_risk(self, score: float) -> str:
        """Risk level determination"""
        if score >= 0.80:
            return "VERY HIGH RISK"
        elif score >= 0.60:
            return "HIGH RISK"
        elif score >= 0.40:
            return "MODERATE RISK"
        elif score >= 0.20:
            return "LOW RISK"
        else:
            return "MINIMAL RISK"
    
    def calculate_text_similarity(self, text1: str, text2: str) -> tuple:
        """
        Calculate text similarity and return (score, details) tuple
        for compatibility with existing main.py code
        """
        if not text1 or not text2:
            return 0.0, {'reason': 'Empty text provided'}
        
        # Use the enhanced analyzer
        result = self.analyze(text1, text2)

        
        # Return tuple format expected by main.py: (score, details)
        details = {
            'phonetic_score': result.scores.phonetic,
            'visual_score': result.scores.visual,
            'overall_score': result.scores.overall,
            'risk_level': result.risk_level,
            'analysis_notes': result.analysis_notes
        }
        
        # Return the overall score as percentage (0-100) and details
        return result.scores.overall * 100, details
    
    def calculate_similarity(self, text1: str, text2: str) -> tuple:
        """Alternative method name for compatibility"""
        return self.calculate_text_similarity(text1, text2)

def run_test_cases():
    """Run test cases including the examples from your query"""
    analyzer = EnhancedTrademarkAnalyzer()
    
    test_cases = [
        ("Visa Master Business", "The Visa Haven"),
        ("bicycle repair shop", "shop for bicycle repair"),
        ("tomato sauce brand", "brand of tomato sauce"),
        ("Apple Inc", "Apple Store"),
        ("Nike Sports", "Sports by Nike"),
        ("Google Search", "Search Google"),
    ]
    
    print("Testing Distance Penalty Implementation:")
    print("=" * 80)
    print(f"{'Client':<25} {'Journal':<30} {'Phonetic':<10} {'Overall':<10} {'Risk':<18}")
    print("-" * 80)
    
    for client, journal in test_cases:
        result = analyzer.analyze(client, journal)
        phonetic_score = f"{result.scores.phonetic*100:.1f}%"
        overall_score = f"{result.scores.overall*100:.1f}%"
        
        print(f"{client:<25} {journal:<30} {phonetic_score:<10} {overall_score:<10} {result.risk_level:<18}")
        if result.analysis_notes:
            print(f"    Notes: {result.analysis_notes}")
        print()

def main():
    """Main function"""
    print("🎯 Enhanced Trademark Analyzer with Distance Penalty")
    print("✅ Distance penalty for partial word matches")
    print("✅ No penalty for exact matches")
    print("✅ Generic term consideration in penalty calculation")
    print("✅ Graduated penalty system based on meaningful word overlap")
    print("=" * 70)

    run_test_cases()

    print("\nInteractive mode (blank to quit):")
    analyzer = EnhancedTrademarkAnalyzer()

    while True:
        client = input("\nClient trademark: ").strip()
        if not client:
            break
        journal = input("Journal text: ").strip()
        if not journal:
            break

        result = analyzer.analyze(client, journal)
        print(f"Phonetic: {result.scores.phonetic:.3f} ({result.scores.phonetic*100:.1f}%)")
        print(f"Visual: {result.scores.visual:.3f} ({result.scores.visual*100:.1f}%)")
        print(f"Overall: {result.scores.overall:.3f} ({result.scores.overall*100:.1f}%)")
        print(f"Risk: {result.risk_level}")
        if result.analysis_notes:
            print(f"Analysis: {result.analysis_notes}")

if __name__ == "__main__":
    main()

