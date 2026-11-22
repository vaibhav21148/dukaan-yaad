// Keyword tables for the offline parser. Data only: add words here, not branches in the parser.
// Each list mixes Hinglish (Roman), Hindi (Devanagari), Marathi, Gujarati and English.

export const KW = {
  /** Item ran out / is low -> reorder */
  stockOut: [
    'khatam', 'khtm', 'khatm', 'khattam', 'khalas', 'khallas', 'khatam ho gaya', 'out of stock', 'stock nahi', 'stock khatam',
    'kam hai', 'kam ho gaya', 'kam ho gayi', 'kam bacha', 'thoda bacha', 'mangwana', 'mangwana hai', 'mangana', 'mangwao', 'mangvana', 'mangwani', 'mangwane',
    'finished', 'finish', 'ran out', 'running low', 'low hai', 'low', 'reorder', 'order karna hai',
    'ख़त्म', 'खत्म', 'खतम', 'कम है', 'मंगवाना', 'मंगाना', 'मँगवाना', 'स्टॉक नहीं',
    'संपले', 'संपला', 'संपली', 'संपलं', 'संपत आले', 'संपत आला', 'कमी आहे', 'कमी झाले', 'मागवायचे', 'मागवायचा', 'मागवा', 'आणायचे', 'sampla', 'sampale', 'sample ahe', 'kami ahe', 'magvayche',
    'ખતમ', 'ખલાસ', 'પૂરું થઈ ગયું', 'પૂરું', 'પુરુ', 'ઓછું છે', 'ઓછું', 'મંગાવવાનું', 'મંગાવવું', 'મંગાવવા', 'mangavvanu', 'khatam thai gayu', 'puru thai gayu',
  ],
  /** Words that say udhaar / credit was given */
  credit: [
    'udhaar', 'udhar', 'udhari', 'udhaari', 'udhaar diya', 'khate mein', 'khata mein', 'khaate mein', 'likh do', 'likh lo', 'likh diya', 'le gaye', 'le gya', 'le gaya', 'le gayi', 'le gayee', 'leke gaye', 'liya', 'liye',
    'on credit', 'credit', 'owes me', 'owes',
    'उधार', 'उधारी', 'खाते में', 'ले गए', 'ले गया', 'ले गई', 'लिया', 'लिखो',
    'उधारीवर', 'उधार नेले', 'नेले', 'घेऊन गेले', 'नेला', 'नेली', 'udhar nele', 'nele',
    'ઉધાર', 'ઉધારે', 'લઈ ગયા', 'લઈ ગયો', 'લઈ ગઈ', 'લીધું', 'લીધા', 'udhar lai gaya', 'lai gaya', 'lai gayo',
  ],
  /** Remaining balance words. Customer credit unless the party looks like a supplier. */
  balance: ['baaki', 'baki', 'baaqi', 'bacha hai', 'pending', 'balance', 'बाकी', 'बाक़ी', 'बाकी आहे', 'शिल्लक', 'બાકી', 'બાકી છે'],
  /** Money came back (customer paid) */
  received: [
    'de diye', 'de diya', 'de gaye', 'de gaya', 'de gayi', 'de gye', 'diye', 'jama', 'jama kiye', 'jama kar diye', 'jama karaye', 'mil gaye', 'mil gaya', 'mile', 'wapas', 'vapas', 'lauta', 'lauta diye', 'chuka', 'chuka diye', 'chukaye', 'chukta',
    'paid back', 'returned', 'gave back', 'received', 'got', 'paid',
    'दे दिए', 'दे दिये', 'दे गए', 'दिए', 'दिये', 'जमा', 'मिल गए', 'मिल गया', 'मिले', 'वापस', 'लौटा', 'चुका', 'चुकाए',
    'दिले', 'परत', 'परत दिले', 'जमा केले', 'मिळाले', 'मिळाला', 'दिले आहेत', 'dile', 'parat', 'milale',
    'આપ્યા', 'આપી ગયા', 'પાછા', 'પાછા આપ્યા', 'જમા', 'મળ્યા', 'મળી ગયા', 'ચૂકવ્યા', 'apya', 'aapya', 'pacha', 'malya',
  ],
  /** Owner paid someone */
  paid: [
    'de diya', 'de diye', 'diya', 'diye', 'paid', 'pay kar diya', 'pay kiya', 'payment kar diya', 'payment de diya', 'payment ho gaya', 'bhej diya', 'bhej diye', 'chuka diya', 'chuka diye', 'gave', 'sent',
    'दे दिया', 'दे दिए', 'दिया', 'दिए', 'भेज दिया', 'भेज दिए', 'चुका दिया', 'पेमेंट कर दिया',
    'दिले', 'पाठवले', 'भरले', 'dile', 'pathavle',
    'આપ્યા', 'આપી દીધા', 'ચૂકવ્યા', 'મોકલ્યા', 'apya', 'aapi didha', 'chukavya',
  ],
  /** Owner still has to pay someone */
  due: [
    'dena', 'dena hai', 'dene', 'dene hai', 'dene hain', 'dena baaki', 'bhejna', 'bhejna hai', 'bhejne', 'bhejne hai', 'bhejni hai', 'bhejne hain', 'payment', 'payment dena', 'payment baaki', 'chukana', 'chukana hai', 'have to pay', 'need to pay', 'to pay', 'owe', 'due',
    'देना', 'देना है', 'देने', 'देने हैं', 'भेजना', 'चुकाना', 'पेमेंट',
    'द्यायचे', 'द्यायचे आहेत', 'द्यायचा', 'देणे', 'देणे आहे', 'भरायचे', 'dyayche', 'dene ahe',
    'આપવાના', 'આપવાના છે', 'આપવા', 'ચૂકવવાના', 'ચૂકવવા', 'apvana', 'aapvana', 'chukavvana',
  ],
  /** Customer order to deliver later */
  order: ['order', 'ordar', 'ऑर्डर', 'आर्डर', 'ઓર્ડર', 'deliver', 'delivery', 'delivery dena', 'pahunchana', 'ghar bhejna', 'home delivery', 'पहुंचाना', 'पोहोचवायचे', 'ડિલિવરી', 'પહોંચાડવાનું'],
  /** Words that mean "no, I mean" */
  correction: ['nahi', 'nahin', 'nai', 'na', 'no', 'not', 'galat', 'sorry', 'matlab', 'i mean', 'actually', 'नहीं', 'नही', 'नाही', 'ना', 'ના', 'નહીં', 'nathi'],
  /** Correction phrase endings: "nahi, 300 tha" */
  correctionTail: ['tha', 'the', 'thi', 'hai', 'hain', 'था', 'थे', 'थी', 'होते', 'होता', 'હતા', 'હતું', 'was'],
};

/** Case markers that come right after a name. */
export const MARKERS = {
  // the named person did the action (gave money / took goods)
  agent: ['ne', 'se', 'ने', 'से', 'कडून', 'यांनी', 'यांच्याकडून', 'એ', 'પાસેથી', 'kadun', 'pasethi'],
  // money / goods went to the named person
  to: ['ko', 'को', 'ला', 'ना', 'ને', 'la', 'यांना'],
  // possessive: "Sharma ji ka 200", "Ramesh ke 5000"
  of: ['ka', 'ke', 'ki', 'यांचे', 'यांची', 'यांचा', 'यांच्याकडे', 'का', 'के', 'की', 'चे', 'ची', 'चा', 'चं', 'कडे', 'નું', 'ના', 'ની', 'નો', 'che', 'chi', 'cha', 'kade', 'nu', 'ni', "'s"],
};

/** Glued suffixes (Marathi / Gujarati often attach the marker to the name). */
export const GLUED = {
  agent: ['ने', 'नी', 'कडून', 'પાસેથી', 'એ'],
  to: ['ला', 'ना', 'ंना', 'ને'],
  of: ['चे', 'ची', 'चा', 'कडे', 'નું', 'ની', 'નો', 'ના'],
};

/** Clause splitters: "aur", "phir" etc. */
export const CONJUNCTIONS = ['aur', 'and', 'phir', 'fir', 'then', 'also', 'plus', 'और', 'फिर', 'तथा', 'आणि', 'नंतर', 'ani', 'aani', 'અને', 'પછી', 'ane', 'pachhi'];

/** Filler words removed from the start of names and items. */
export const FILLER = [
  'aaj', 'aj', 'kal', 'abhi', 'aur', 'and', 'phir', 'fir', 'then', 'also', 'maine', 'mene', 'humne', 'hamne', 'mai', 'main', 'i', 'we', 'today', 'tomorrow', 'bhi', 'to', 'toh', 'wo', 'woh', 'yeh', 'ye', 'the', 'a', 'apna', 'apne', 'hamara', 'mera', 'sab', 'saare', 'sare', 'sara', 'stock', 'ka', 'ki', 'ke', 'hai', 'ho', 'gaya', 'gaye', 'gayi', 'hain', 'please', 'ok', 'okay', 'haan', 'acha', 'accha',
  'आज', 'कल', 'अभी', 'और', 'फिर', 'मैंने', 'हमने', 'भी', 'तो', 'सब', 'सारा', 'स्टॉक', 'है', 'हो', 'गया',
  'आज', 'उद्या', 'आणि', 'मी', 'आम्ही', 'पण', 'सगळे', 'आहे', 'झाले',
  'આજે', 'કાલે', 'અને', 'મેં', 'અમે', 'પણ', 'બધું', 'છે', 'થઈ', 'ગયું',
];

/** Words that mark the party as a supplier, not a customer. */
export const SUPPLIER_HINTS = ['distributor', 'distributors', 'supplier', 'agency', 'agencies', 'traders', 'trader', 'wholesale', 'wholesaler', 'company', 'enterprises', 'seth', 'sheth', 'wale', 'wala', 'vala', 'डिस्ट्रीब्यूटर', 'सप्लायर', 'एजेंसी', 'वाले', 'सेठ', 'शेठ', 'ડિસ્ટ્રીબ્યુટર', 'શેઠ', 'વાળા'];

/** Words removed from order/item text (time and filler). */
export const TIME_WORDS = ['for', 'of', 'kal', 'parso', 'aaj', 'subah', 'shaam', 'sham', 'raat', 'dopahar', 'tak', 'ko', 'hai', 'dena', 'deni', 'dene', 'ka', 'ke', 'ki', 'morning', 'evening', 'tonight', 'by', 'tomorrow', 'today',
  'कल', 'परसों', 'आज', 'सुबह', 'शाम', 'रात', 'तक', 'को', 'है', 'देना', 'उद्या', 'सकाळी', 'संध्याकाळी', 'पर्यंत', 'आहे', 'द्यायची', 'કાલે', 'આજે', 'સવારે', 'સાંજે', 'સુધી', 'છે', 'આપવાનો', 'આપવાનું'];
