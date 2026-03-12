require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { google } = require("googleapis");

let sharp, Tesseract;
try {
  sharp = require("sharp");
} catch (e) {
  console.log("⚠️  sharp module failed to load:", e.message);
}
try {
  Tesseract = require("tesseract.js");
} catch (e) {
  console.log("⚠️  tesseract.js module failed to load:", e.message);
}
const paymentConfig = require("./paymentConfig");

const app = express();

/*
 ─── CORS: Allowed frontend domains ──────────────────────────────────────────
*/
const allowedOrigins = [
  // Vercel domains
  "https://nri-tech-arena-hackthon-system-webs.vercel.app",
  "https://nri-tech-arena-hackthon-system-git-affb3c-sharma0527s-projects.vercel.app",
  "https://nri-tech-arena-hackthon-system-website-hvau21qom.vercel.app",
  "https://nri-tech-arena-hackthon-system-git-d2617a-sharma0527s-projects.vercel.app",
  "https://nri-techarena-hackthon-system-website-7rvwrhh6l.vercel.app",
  // Cloudflare Pages (New)
  "https://nri-techarena-hackthon-system-0527.pages.dev",
  "https://nri-techarena-hackthon-system-website-527.pages.dev",
  // Local development
  "http://localhost:5173",
  "http://localhost:3000"
];

const corsOptions = {
  origin: [
    "https://nri-techarena-hackthon-system-0527.pages.dev",
    "http://localhost:5173",
    "http://localhost:3000"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

app.use(express.json());

// ─── Health Checks ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("Hackathon Registration Backend is running 🚀");
});

app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "hackathon-backend",
    email: emailReady ? "ready" : "not configured",
    emailAccount: process.env.EMAIL ? process.env.EMAIL.replace(/(.{3}).*(@.*)/, '$1***$2') : "missing",
    sheets: sheets ? "connected" : "disabled",
    drive: drive ? "connected" : "disabled"
  });
});

// ─── Test Route ────────────────────────────────────────────────────────────────
app.get("/api/getRegistrations", (req, res) => {
  res.json({ status: "API working" });
});

// ─── Static Uploads: Serve from both root and payments subfolder ────────────────
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/uploads", express.static(path.join(__dirname, "uploads", "payments")));
// Fallback for direct /uploads/payments/ access
app.use("/uploads/payments", express.static(path.join(__dirname, "uploads", "payments")));

// ─── Google API Setup (Sheets + Drive) ─────────────────────────────────────────
const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1LarTOmgXNCCmcQ0Lu-MRIlCY3fvrUDNzqoPiN__yCOQ";
let sheets, drive;

let auth;
if (process.env.GOOGLE_CREDENTIALS) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ],
    });
  } catch (e) {
    console.log("⚠️  Failed to parse GOOGLE_CREDENTIALS env var:", e.message);
  }
} else {
  const serviceAccountPath = path.join(__dirname, "credentials.json");
  if (fs.existsSync(serviceAccountPath)) {
    auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ],
    });
  } else {
    console.log("⚠️  Credentials file not found — Google Sheets/Drive disabled.");
    console.log("   Place your credentials JSON at:", serviceAccountPath);
  }
}

if (auth) {
  try {
    sheets = google.sheets({ version: "v4", auth });
    drive = google.drive({ version: "v3", auth });
    console.log("✅ Connected to Google Sheets + Drive API");
  } catch (error) {
    console.log("⚠️  Google API auth failed:", error.message);
  }
}

// ─── Google Sheets: Add Row ────────────────────────────────────────────────────
async function addToSheet(data) {
  if (!sheets) return;
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Sheet1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [data] }
    });
    console.log("✅ Row added to Google Sheet");
  } catch (error) {
    console.error("❌ Google Sheet error:", error.message);
  }
}

// ─── Google Drive: Upload Screenshot ───────────────────────────────────────────
async function uploadToDrive(filePath, fileName) {
  if (!drive) return null;
  try {
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: "image/png",
        parents: ["1X8g2REvmp6cnXwcuYn_LKDanTSvv88jq"]
      },
      media: {
        mimeType: "image/png",
        body: fs.createReadStream(filePath)
      },
      fields: "id"
    });

    // Convert to direct image URL
    const fileId = response.data.id;
    const directUrl = `https://drive.google.com/uc?id=${fileId}`;

    console.log("✅ Screenshot uploaded to Drive:", directUrl);
    return directUrl;
  } catch (error) {
    console.error("❌ Drive upload error:", error.message);
    return null;
  }
}

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many verification attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: "Too many registration attempts. Try again later." },
});

// ─── Multer Config ─────────────────────────────────────────────────────────────
const upload = multer({
  dest: "uploads/payments/",
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only PNG, JPEG, and WebP images are allowed"), false);
  }
});

// ─── Payment Config ────────────────────────────────────────────────────────────
app.get("/api/payment-config", (req, res) => {
  const active = paymentConfig.accounts.find(a => a.id === paymentConfig.activeQR);
  res.json(active);
});

app.post("/api/change-qr", (req, res) => {
  const { qrId } = req.body;
  const exists = paymentConfig.accounts.find(a => a.id === qrId);
  if (!exists) {
    return res.status(400).json({ error: "Invalid QR" });
  }
  paymentConfig.activeQR = qrId;
  res.json({ success: true, activeQR: qrId });
});

// ─── Payment Status & Deadline ─────────────────────────────────────────────────
let appStatus = { paymentsStopped: false };
const statusPath = path.join(__dirname, "status.json");
if (fs.existsSync(statusPath)) {
  try {
    appStatus = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
  } catch (e) { }
}

const getPaymentState = () => {
  const deadline = new Date("2026-03-28T12:00:00+05:30");
  const now = new Date();
  const isPastDeadline = now > deadline;
  return {
    paymentsStopped: appStatus.paymentsStopped || isPastDeadline,
    deadline: deadline.toISOString()
  };
};

app.get("/api/payment-status", (req, res) => {
  res.json(getPaymentState());
});

app.post("/api/toggle-payment", (req, res) => {
  const adminKey = process.env.ADMIN_KEY || "supersecretadmin";
  if (req.headers.authorization !== adminKey) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  appStatus.paymentsStopped = !appStatus.paymentsStopped;
  fs.writeFileSync(statusPath, JSON.stringify(appStatus));
  res.json(getPaymentState());
});

// ─── Email Transport ───────────────────────────────────────────────────────────
let emailReady = false;
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
  connectionTimeout: 10000,  // 10s to establish connection
  greetingTimeout: 10000,    // 10s for SMTP greeting
  socketTimeout: 15000,      // 15s for socket inactivity
});

// Verify email credentials on startup
if (process.env.EMAIL && process.env.PASSWORD) {
  transporter.verify()
    .then(() => {
      emailReady = true;
      console.log(`✅ Email transport verified (${process.env.EMAIL})`);
    })
    .catch(err => {
      console.error(`❌ Email transport FAILED: ${err.message}`);
      console.error(`   Emails will NOT work until this is fixed.`);
    });
} else {
  console.error("⚠️  EMAIL or PASSWORD env var missing — email features disabled.");
}

// ─── Permanent Storage ──────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, "data", "registrations.json");

/* Load registrations from disk */
function loadRegistrationsFromDisk() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      if (!fs.existsSync(path.join(__dirname, "data"))) {
        fs.mkdirSync(path.join(__dirname, "data"));
      }
      fs.writeFileSync(DATA_FILE, "[]");
    }
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("❌ Failed loading registrations:", err);
    return [];
  }
}

/* Save registration permanently */
function saveRegistrationPermanent(registration) {
  try {
    let data = loadRegistrationsFromDisk();
    data.push(registration);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log("✅ Registration permanently stored");
  } catch (err) {
    console.error("❌ Failed saving registration:", err);
  }
}

// ─── In-Memory Stores ──────────────────────────────────────────────────────────
const registrationsDB = {};
const usedUTRs = new Set();
const usedImageHashes = new Set();

// Load existing registrations and locked fraud signatures
const storedRegistrations = loadRegistrationsFromDisk();
storedRegistrations.forEach(reg => {
  registrationsDB[reg.OrderID || reg.orderId] = reg;
  if (reg.UTR) usedUTRs.add(reg.UTR.toString().replace(/\s/g, "").trim());
  if (reg.ScreenshotHash) usedImageHashes.add(reg.ScreenshotHash);
});
console.log(`✅ Loaded ${storedRegistrations.length} registrations from persistent storage.`);

// Load additional UTRs and Hashes from Excel (if any exist independently)
const excelDBPath = path.join(__dirname, "registrations.xlsx");
const backupDBPath = path.join(__dirname, "registrations_testing_backup.xlsx");

[excelDBPath, backupDBPath].forEach(dbPath => {
  if (fs.existsSync(dbPath)) {
    try {
      const wb = xlsx.readFile(dbPath);
      if (wb.Sheets["Registrations"]) {
        const data = xlsx.utils.sheet_to_json(wb.Sheets["Registrations"]);
        data.forEach(row => {
          if (row.UTR) usedUTRs.add(row.UTR.toString().replace(/\s/g, "").trim());
          if (row.ScreenshotHash) usedImageHashes.add(row.ScreenshotHash);
        });
      }
    } catch (e) {
      console.error(`Error loading DB: ${dbPath}`, e);
    }
  }
});
if (usedUTRs.size > 0 || usedImageHashes.size > 0) {
  console.log(`✅ Locked ${usedUTRs.size} previously successful UTRs and ${usedImageHashes.size} hashes.`);
}

// ─── Dynamic Fee Calculator ────────────────────────────────────────────────────
function calculateFee(memberCount) {
  return 1000; // Fixed Amount: ₹1000 fee
}

// ─── Image Hash ────────────────────────────────────────────────────────────────
function computeImageHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(fileBuffer).digest("hex");
}

// ─── OCR Verification ──────────────────────────────────────────────────────────
async function verifyPayment(imagePath, expectedAmount, utr) {
  if (!sharp || !Tesseract) {
    return { success: false, reason: "OCR modules not available on this server", confidence: 0, score: 0 };
  }
  const meta = await sharp(imagePath).metadata();
  const isValidMetadata = meta.width >= 400 && meta.height >= 400;

  const preprocessedPath = imagePath + "_processed.png";
  await sharp(imagePath)
    .resize({ width: 2200 })
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(140)
    .toFile(preprocessedPath);

  const result = await Tesseract.recognize(preprocessedPath, "eng", {
    tessedit_pageseg_mode: 6,
    tessedit_ocr_engine_mode: 1
  });

  try { fs.unlinkSync(preprocessedPath); } catch (e) { }

  let rawText = result.data.text.toLowerCase();
  const text = rawText.replace(/\n/g, " ");
  const confidence = result.data.confidence;

  const today = new Date();
  const cleanOCRText = text.replace(/[^a-z0-9]/g, "");

  // 3️⃣ Receiver Validation (Matches against ALL official accounts)
  const allAccounts = paymentConfig.accounts;
  let finalNameCheck = false;
  for (const account of allAccounts) {
    const validNames = [
      account.name.toLowerCase().replace(/\s+/g, ""),
      account.altName ? account.altName.toLowerCase().replace(/\s+/g, "") : "",
      account.bankingName ? account.bankingName.toLowerCase().replace(/\s+/g, "") : ""
    ].filter(Boolean);
    const exactUpi = account.upi.toLowerCase().replace(/\s+/g, "");
    if (validNames.some(name => cleanOCRText.includes(name.replace(/[^a-z0-9]/g, ""))) ||
      cleanOCRText.includes(exactUpi.replace(/[^a-z0-9]/g, ""))) {
      finalNameCheck = true;
      break;
    }
  }

  // 4️⃣ Amount Validation (Fixed ₹1000)
  const amountStr = expectedAmount.toString();
  const cleanTextNum = text.replace(/[₹,\s]/g, '').replace(/\.00/g, '');
  const amountCheck = cleanTextNum.includes(amountStr);

  // 5️⃣ Status Detection
  const successKeywords = ["transactionsuccessful", "paymentsuccessful", "success", "paidto", "completed"];
  const statusCheck = successKeywords.some(word => cleanOCRText.includes(word));

  // 6️⃣ UTR Pattern Verification
  const cleanUTR = utr ? utr.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const fuzzyNormalize = (s) => s.replace(/8/g, 'b').replace(/0/g, 'o').replace(/1/g, 'i').replace(/5/g, 's').replace(/2/g, 'z');
  const utrCheck = cleanUTR.length > 0 && (cleanOCRText.includes(cleanUTR) || fuzzyNormalize(cleanOCRText).includes(fuzzyNormalize(cleanUTR)));

  // 7️⃣ Date Validation (Supports Today, Yesterday, 2 Days Ago)
  const getDateOptions = (date) => [
    date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toLowerCase().replace(/[^a-z0-9]/g, ""),
    date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }).toLowerCase().replace(/[^a-z0-9]/g, ""),
    (date.toLocaleDateString("en-US", { month: "short" }).toLowerCase() + date.getDate()),
    (date.getDate() + date.toLocaleDateString("en-US", { month: "short" }).toLowerCase())
  ];
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const twoDaysAgo = new Date(); twoDaysAgo.setDate(today.getDate() - 2);
  const allDateOptions = [...getDateOptions(today), ...getDateOptions(yesterday), ...getDateOptions(twoDaysAgo), "today", "now"];
  const dateCheck = allDateOptions.some(opt => cleanOCRText.includes(opt));

  if (finalNameCheck && statusCheck && amountCheck && utrCheck && dateCheck) {
    return { success: true, confidence, score: 100, checks: { name: true, status: true, amount: true, utr: true, date: true } };
  } else {
    // ─── Score Based Fallback ───
    let score = 0;
    if (finalNameCheck) score += 25;
    if (statusCheck) score += 25;
    if (amountCheck) score += 20;
    if (utrCheck) score += 30;
    if (dateCheck) score += 10;

    const isFuzzyPass = score >= 80;

    if (isFuzzyPass) {
      return {
        success: true,
        confidence,
        score,
        checks: { name: finalNameCheck, status: statusCheck, amount: amountCheck, utr: utrCheck, date: dateCheck }
      };
    }

    let missingInfo = [];
    if (!finalNameCheck) missingInfo.push("Receiver");
    if (!statusCheck) missingInfo.push("Status");
    if (!amountCheck) missingInfo.push(`Amount ₹${expectedAmount}`);
    if (!utrCheck) missingInfo.push("UTR Match");
    if (!dateCheck) missingInfo.push("Date Context");

    return {
      success: false,
      reason: `Missing: ${missingInfo.join(", ")}`,
      confidence,
      score,
      checks: { name: finalNameCheck, status: statusCheck, amount: amountCheck, utr: utrCheck, date: dateCheck }
    };
  }
}


// ─── Send Confirmation Email ───────────────────────────────────────────────────
async function sendConfirmationEmail(to, name, teamName, domain, utr) {
  const mailOptions = {
    from: process.env.EMAIL,
    to: to,
    subject: "Hackathon Registration Confirmed",
    html: `
  <h2>Hackathon Registration Confirmed</h2>

  <p>Dear ${name},</p>

  <p>Your team <b>${teamName}</b> registration has been successfully verified.</p>

  <h3>Accommodation Contact</h3>

  <p>Surya : +91 97017 11338</p>
  <p>Vijay : +91 93927 57990</p>
  <p>Sai : +91 72075 94604</p>
  <p>Sharma : +91 8688011599</p>

  <h3>Terms & Conditions</h3>

  <ul>
  <li>Accommodation is only for outside registered participants.</li>
  <li>Carry your college ID and registration confirmation.</li>
  <li>Follow all instructions provided by organizers.</li>
  <li>Misconduct or rule violations may lead to disqualification.</li>
  <li>Accommodation is subject to availability.</li>
  </ul>

  <p>We look forward to your participation.</p>

  <p>
  Regards <br>
  NRI Institute of Technology
  </p>
  `
  };

  try {
    // Timeout after 15s to prevent hanging
    const sendWithTimeout = Promise.race([
      transporter.sendMail(mailOptions),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Email timeout after 15s")), 15000))
    ]);
    await sendWithTimeout;
    console.log(`📧 Email sent to ${to}`);
  } catch (e) {
    console.error(`❌ Failed to send email to ${to}:`, e.message);
    throw e; // Re-throw so Promise.allSettled tracks this as a rejection
  }
}

// ═════════════════════════════════════════════════════════════════════════════════
//  EXISTING EMAIL ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════════

app.post("/send-mails", upload.single("file"), async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);
    const emails = data.map(row => row.email).filter(Boolean);

    let success = [];
    let failed = [];

    for (let email of emails) {
      try {
        await transporter.sendMail({ from: process.env.EMAIL, to: email, subject, text: message });
        success.push(email);
      } catch (err) { failed.push(email); }
    }

    res.json({ total: emails.length, success, failed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong" });
  }
});

app.post("/send-single-mail", async (req, res) => {
  try {
    const { email, subject, message } = req.body;
    if (!email || !subject || !message) return res.status(400).json({ error: "Missing required fields" });

    if (!process.env.EMAIL || !process.env.PASSWORD) {
      return res.status(503).json({ error: "Email service not configured. Set EMAIL and PASSWORD environment variables." });
    }

    console.log(`📧 Sending email to ${email}...`);

    // Add a 20s timeout so the request doesn't hang forever
    const sendWithTimeout = Promise.race([
      transporter.sendMail({ from: process.env.EMAIL, to: email, subject, text: message }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Email send timed out after 20 seconds")), 20000))
    ]);

    await sendWithTimeout;
    console.log(`✅ Email sent to ${email}`);
    res.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error(`❌ Email to ${req.body?.email} failed:`, error.message);
    res.status(500).json({ error: `Email failed: ${error.message}` });
  }
});

// ═════════════════════════════════════════════════════════════════════════════════
//  HACKATHON REGISTRATION
// ═════════════════════════════════════════════════════════════════════════════════

app.post("/api/register", registerLimiter, (req, res) => {
  const { teamName, domain, department, branch, teamLeadName, teamLeadEmail, teamLeadPhone, members } = req.body;

  if (!teamName || !teamLeadName || !teamLeadEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Duplicate email check
  const allEmails = [teamLeadEmail, ...(members || []).map(m => m.email).filter(Boolean)];
  const uniqueEmails = new Set(allEmails.map(e => e.toLowerCase().trim()));
  if (uniqueEmails.size !== allEmails.filter(Boolean).length) {
    return res.status(400).json({ error: "Duplicate email addresses detected in team" });
  }

  // Team size validation (4-5 total including lead)
  const totalMembers = (members || []).length + 1;
  if (totalMembers < 4 || totalMembers > 5) {
    return res.status(400).json({ error: "Team must have 4-5 members (including team lead)" });
  }

  const orderId = "order_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  registrationsDB[orderId] = {
    orderId, teamName, domain, department, branch,
    teamLeadName, teamLeadEmail, teamLeadPhone,
    members,
    status: "Pending Payment",
    attempts: 0,
    createdAt: new Date(),
  };

  const fee = calculateFee(totalMembers);
  res.json({ orderId, fee, message: "Order created successfully" });
});

// ═════════════════════════════════════════════════════════════════════════════════
//  PAYMENT VERIFICATION PIPELINE
// ═════════════════════════════════════════════════════════════════════════════════

app.post("/api/verify-payment", verifyLimiter, upload.single("screenshot"), async (req, res) => {
  const { paymentsStopped } = getPaymentState();
  if (paymentsStopped) {
    return res.status(403).json({ success: false, message: "Payments have officially been closed." });
  }

  try {
    const { orderId, utr } = req.body;

    // Input validation
    if (!req.file) return res.status(400).json({ success: false, message: "Screenshot is required" });
    if (!orderId) return res.status(400).json({ success: false, message: "Order ID is required" });

    // Step 1: Secure UTR Format Validation (Strict 12-digit numeric)
    const normalizedUTR = utr ? utr.replace(/\s/g, "").trim() : "";
    const utrRegex = /^\d{12}$/;
    if (!utrRegex.test(normalizedUTR)) {
      return res.status(400).json({ success: false, message: "UTR must be exactly 12 digits." });
    }

    const reg = registrationsDB[orderId];
    if (!reg) return res.status(404).json({ success: false, message: "Order not found" });

    // Anti-abuse: max 5 attempts
    reg.attempts = (reg.attempts || 0) + 1;
    if (reg.attempts > 5) {
      return res.status(429).json({ success: false, message: "Maximum attempts exceeded. Contact support." });
    }

    // ── FRAUD CHECK 1: Duplicate UTR ──
    if (usedUTRs.has(normalizedUTR)) {
      return res.status(400).json({
        success: false,
        message: `Duplicate payment reference: UTR ${normalizedUTR} has already been verified for another team.`,
      });
    }

    // ── FRAUD CHECK 2: Duplicate Screenshot (SHA256 hash) ──
    const imageHash = computeImageHash(req.file.path);
    if (usedImageHashes.has(imageHash)) {
      return res.status(400).json({
        success: false,
        message: "This screenshot has already been used. Each registration requires a unique payment.",
      });
    }

    // ── Calculate Dynamic Fee ──
    const totalMembers = (reg.members || []).length + 1;
    const amount = calculateFee(totalMembers);

    // ── OCR + Fraud Verification ──
    const verification = await verifyPayment(req.file.path, amount, normalizedUTR);

    if (!verification.success) {
      reg.status = "Payment Failed";
      return res.status(400).json({
        success: false,
        message: verification.reason,
        score: verification.score,
        checks: verification.checks
      });
    }

    // ── 1. Update State & Lock Fraud ──
    usedUTRs.add(normalizedUTR);
    usedImageHashes.add(imageHash);
    reg.status = "Confirmed";
    reg.utr = normalizedUTR;

    // ── 2. Permanent Image Storage ──
    const ext = path.extname(req.file.originalname) || ".png";
    const newFilename = `${orderId}_${Date.now()}${ext}`;
    const permanentPath = path.join(__dirname, "uploads", "payments", newFilename);

    try {
      if (fs.existsSync(req.file.path)) {
        fs.renameSync(req.file.path, permanentPath);
      }
    } catch (e) {
      console.error("Failed to move screenshot:", e.message);
    }

    const localImageUrl = `/uploads/payments/${newFilename}`;
    const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || "https://nri-techarena-hackthon-system-website-3.onrender.com";
    let screenshotUrl = `${BACKEND_URL}${localImageUrl}`;

    // Save to memory DB for persistence across flushes
    reg.Screenshot = screenshotUrl;
    reg.utr = normalizedUTR;
    reg.status = "Confirmed";

    // ── 3. Immediate Confirmation ──
    // We send success EARLY because we've locked the UTR and updated memory state.
    // Heavy tasks like Cloud Sync and Multi-Emails run in background.
    res.json({ success: true, message: "Payment verified and registration confirmed!" });

    // ── 4. Robust Background Tasks ──
    (async () => {
      try {
        // Cloud Drive Sync
        const driveUrl = await uploadToDrive(permanentPath, newFilename);

        // Update screenshotUrl if Drive upload succeeded
        if (driveUrl) {
          screenshotUrl = driveUrl;
          // Update the Excel record and JSON with the cloud URL too
          reg.screenshotUrl = driveUrl;
        }

        const activeAccount = paymentConfig.accounts.find(a => a.id === paymentConfig.activeQR);

        const registrationRecord = {
          OrderID: reg.orderId,
          TeamName: reg.teamName,
          Department: reg.department || "",
          Domain: reg.domain || "",
          Branch: reg.branch || "",
          LeadName: reg.teamLeadName,
          LeadEmail: reg.teamLeadEmail,
          LeadPhone: reg.teamLeadPhone || "",
          Members: totalMembers,
          UTR: normalizedUTR,
          Amount: amount,
          Receiver: activeAccount ? activeAccount.name : "Unknown",
          QR_ID: activeAccount ? activeAccount.id : 0,
          Screenshot: screenshotUrl,
          ScreenshotHash: imageHash,
          Status: "Confirmed",
          Date: new Date().toISOString()
        };

        // Permanent storage
        saveRegistrationPermanent(registrationRecord);

        // Memory update
        registrationsDB[reg.orderId] = registrationRecord;

        // Excel Update
        const excelPath = path.join(__dirname, "registrations.xlsx");
        const excelRow = {
          OrderID: reg.orderId, TeamName: reg.teamName, LeadName: reg.teamLeadName,
          LeadEmail: reg.teamLeadEmail, UTR: normalizedUTR, Amount: amount,
          Receiver: activeAccount ? activeAccount.name : "Unknown",
          QR_ID: activeAccount ? activeAccount.id : null,
          Screenshot: screenshotUrl, Status: "Confirmed", Date: new Date().toLocaleString()
        };
        let workbook = fs.existsSync(excelPath) ? xlsx.readFile(excelPath) : xlsx.utils.book_new();
        if (!workbook.Sheets["Registrations"]) xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([]), "Registrations");
        const data = xlsx.utils.sheet_to_json(workbook.Sheets["Registrations"]);
        data.push(excelRow);
        workbook.Sheets["Registrations"] = xlsx.utils.json_to_sheet(data);
        xlsx.writeFile(workbook, excelPath);

        // Google Sheets Append
        await addToSheet([orderId, reg.teamName, reg.teamLeadName, reg.teamLeadEmail, normalizedUTR, amount.toString(), activeAccount ? activeAccount.id : "", screenshotUrl, "Confirmed", new Date().toLocaleString()]);

        // Multi-Member Email Automation
        console.log(`📧 Dispatching emails for team: ${reg.teamName}`);

        // 1. Team Lead Email
        try {
          await sendConfirmationEmail(reg.teamLeadEmail, reg.teamLeadName, reg.teamName, reg.domain, normalizedUTR);
        } catch (e) {
          console.error(`⚠️ Lead email failed but registration is recorded:`, e.message);
        }

        // 2. Additional Member Emails
        if (reg.members && reg.members.length > 0) {
          for (const m of reg.members) {
            if (m.email && m.email.trim()) {
              try {
                await sendConfirmationEmail(m.email.trim(), m.name, reg.teamName, reg.domain, normalizedUTR);
              } catch (e) {
                console.error(`⚠️ Member email (${m.email}) failed:`, e.message);
              }
            }
          }
        }

        console.log(`✅ All background processing finished for ${orderId}`);
      } catch (err) {
        console.error("🔥 Critical Background Task Error:", err);
      }
    })();

  } catch (error) {
    console.error("❌ Verification Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

app.get("/admin/backups", (req, res) => {
  try {
    // Return all records from permanent storage as backups
    const data = loadRegistrationsFromDisk();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Backup fetch failed" });
  }
});

// ─── Admin: Fetch All Registrations (from Disk) ───────────────────────────────
app.get("/admin/registrations", (req, res) => {
  try {
    const data = loadRegistrationsFromDisk();
    res.json(data.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch registrations" });
  }
});

// ─── Backend – Delete Registration ─────────────────────────────────────────────
app.delete("/api/delete-registration/:orderId", async (req, res) => {
  try {
    // Security Recommendation: Admin Protection
    const adminKey = process.env.ADMIN_KEY || "supersecretadmin";
    if (req.headers.authorization !== adminKey) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { orderId } = req.params;

    // 1. Delete from Excel (Local DB) so the dashboard updates correctly
    const excelPath = path.join(__dirname, "registrations.xlsx");
    if (fs.existsSync(excelPath)) {
      const workbook = xlsx.readFile(excelPath);
      if (workbook.Sheets["Registrations"]) {
        let data = xlsx.utils.sheet_to_json(workbook.Sheets["Registrations"]);
        // Keep rows that do not match the orderId
        data = data.filter(row => row.OrderID !== orderId);
        workbook.Sheets["Registrations"] = xlsx.utils.json_to_sheet(data);
        xlsx.writeFile(workbook, excelPath);
      }
    }

    // 2. Delete from Google Sheets (if connected)
    if (sheets) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: "Sheet1!A2:L",
      });

      const rows = response.data.values;
      let rowIndex = -1;
      if (rows) {
        rowIndex = rows.findIndex(row => row[0] === orderId);
      }

      if (rowIndex !== -1) {
        const deleteRow = rowIndex + 2;
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SHEET_ID,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 0,
                    dimension: "ROWS",
                    startIndex: deleteRow - 1,
                    endIndex: deleteRow
                  }
                }
              }
            ]
          }
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Delete failed" });
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n${"═".repeat(50)}`);
  console.log(`  Hackathon Registration Server`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Email: ${process.env.EMAIL}`);
  console.log(`  Google Sheets: ${sheets ? "Connected" : "Disabled"}`);
  console.log(`  Google Drive: ${drive ? "Connected" : "Disabled"}`);
  console.log(`${"═".repeat(50)}\n`);
});
