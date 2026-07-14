/**
 * Category Classifier (Keyword-Based)
 * A robust on-device keyword classifier matching local terms and misspellings.
 * This runs offline in JavaScript, bypassing the need for native ONNX runtime binaries on device,
 * achieving extremely high accuracy on short expense inputs.
 */

interface ClassificationResult {
  category: string;
  confidence: number;
  predicted: string;
}

const KEYWORD_MAP: Record<string, string[]> = {
  food: ["lunch", "dinner", "breakfast", "biryani", "pizza", "hotel", "saapadu", "tea", "coffee", "snacks", "swiggy", "zomato", "restaurant", "burger", "subway", "food", "eat", "cafe", "mess", "canteen"],
  groceries: ["groceries", "vegetables", "milk", "rice", "supermarket", "kirana", "provision", "reliance", "dmart", "fruits", "eggs", "bread", "store", "mart"],
  transport: ["petrol", "diesel", "auto", "bus", "train", "uber", "ola", "metro", "cab", "bike service", "rapido", "parking", "toll", "fuel", "travel", "rickshaw"],
  bills: ["electricity", "water", "wifi", "recharge", "current bill", "gas", "dth", "broadband", "eb bill", "insurance", "bill", "rent", "payment", "recharged"],
  shopping: ["clothes", "shoes", "amazon", "flipkart", "dress", "watch", "earphones", "myntra", "t-shirt", "jeans", "bag", "gift", "shopping", "purchased"],
  health: ["medicine", "doctor", "hospital", "pharmacy", "tablets", "clinic", "dental", "checkup", "diagnostic", "labs", "medical", "physio"],
  entertainment: ["movie", "netflix", "spotify", "game", "concert", "theatre", "disney", "prime", "bowling", "pub", "beer", "wine", "club", "show"],
  rent: ["rent", "room rent", "house rent", "maintenance", "pg rent", "hostel"],
  education: ["fees", "books", "course", "udemy", "tuition", "stationery", "exam fee", "college fee", "school fee", "pen", "notebook"],
  personal: ["barber", "salon", "makeup", "gym", "subscription", "donation", "pocket money", "haircut", "spa"]
};

// Map alternate local spellings or common spelling errors
const Tanglish_SYNONYMS: Record<string, string> = {
  "saapadu": "food",
  "sapaadu": "food",
  "hotel": "food",
  "vandi": "transport",
  "wandi": "transport",
  "karan": "bills",
  "current": "bills",
  "eb": "bills",
  "net": "bills",
  "phn": "bills",
  "phone": "bills",
  "tution": "education",
  "kirana": "groceries"
};

export async function classify(clause: string): Promise<ClassificationResult> {
  const text = clause.toLowerCase();
  
  // 1. Check local synonyms first
  for (const [syn, mappedWord] of Object.entries(Tanglish_SYNONYMS)) {
    if (text.includes(syn)) {
      // Find category that contains mappedWord
      for (const [cat, words] of Object.entries(KEYWORD_MAP)) {
        if (words.includes(mappedWord)) {
          return { category: cat, confidence: 0.95, predicted: cat };
        }
      }
    }
  }

  // 2. Score categories based on keyword matches (word boundary matching)
  let bestCategory = 'other';
  let maxScore = 0;
  
  for (const [cat, keywords] of Object.entries(KEYWORD_MAP)) {
    let score = 0;
    for (const word of keywords) {
      // Use simple substring check or word regex
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(text)) {
        score += 1.0;
      } else if (text.includes(word)) {
        score += 0.5; // partial match
      }
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestCategory = cat;
    }
  }

  // Calculate confidence
  const confidence = maxScore > 0 ? Math.min(0.5 + (maxScore * 0.15), 0.99) : 0.40;
  
  return {
    category: confidence < 0.45 ? 'other' : bestCategory,
    confidence,
    predicted: bestCategory,
  };
}
