/**
 * FDA Guidance Document Scraper
 *
 * Uses Puppeteer to scrape FDA's guidance document search page,
 * which requires JavaScript rendering.
 *
 * Usage: npx tsx scripts/scrape-fda-documents.ts [--limit=100] [--import]
 *
 * Options:
 *   --limit=N   Maximum number of documents to scrape (default: 100)
 *   --import    Import scraped documents into the database
 *   --dry-run   Just output the documents found (default behavior)
 */

import puppeteer, { Page } from "puppeteer";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, DocumentStatus, TagCategory } from "@prisma/client";
import * as fs from "fs";

// Parse command line arguments
const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1]) : 100;
const shouldImport = args.includes("--import");
const dryRun = !shouldImport;

interface ScrapedDocument {
  title: string;
  fdaDocumentId: string;
  issueDate: Date;
  status: DocumentStatus;
  pdfUrl: string;
  summary: string | null;
  center: string;
  detailUrl: string;
  tags: string[];
}

// FDA-defined tags for inference
const TAG_KEYWORDS: Record<string, string[]> = {
  "Clinical Trials": ["clinical trial", "clinical study", "clinical investigation"],
  "Chemistry, Manufacturing, and Controls (CMC)": ["cmc", "chemistry", "manufacturing", "controls"],
  "Good Manufacturing Practice (GMP)": ["gmp", "good manufacturing", "cgmp"],
  "Labeling": ["label", "labeling"],
  "Quality Systems": ["quality system", "quality management"],
  "Bioequivalence": ["bioequivalence", "bioavailability", "ba/be"],
  "Safety Reporting": ["safety", "adverse event", "adverse reaction", "pharmacovigilance"],
  "Preclinical Studies": ["preclinical", "nonclinical", "toxicology"],
  "Postmarket Surveillance": ["postmarket", "post-market"],
  "Regulatory Submissions": ["submission", "nda", "anda", "bla", "510(k)", "pma", "ind"],
  "Drug Development": ["drug development", "pharmaceutical development"],
  "Device Classification": ["device classification", "classify"],
  "Pediatric Development": ["pediatric", "children", "neonatal"],
  "Orphan Drugs": ["orphan drug", "rare disease"],
  "Biosimilars": ["biosimilar", "interchangeable"],
  "Generic Drugs": ["generic drug", "anda"],
  "OTC Drugs": ["over-the-counter", "otc", "nonprescription"],
  "COVID-19": ["covid", "coronavirus", "sars-cov"],
  "Digital Health": ["digital health", "software", "mobile", "samd", "clinical decision support"],
  "Artificial Intelligence": ["artificial intelligence", "machine learning", " ai ", "algorithm"],
  "Cellular & Gene Therapy": ["cell therapy", "gene therapy", "regenerative", "cart", "crispr"],
  "Nanotechnology": ["nanotechnology", "nanoparticle", "nanomaterial"],
  "3D Printing": ["3d print", "additive manufacturing"],
};

const CENTER_PRODUCT_AREAS: Record<string, string> = {
  CDER: "Drugs",
  CBER: "Biologics",
  CDRH: "Medical Devices",
  CFSAN: "Food & Dietary Supplements",
  CVM: "Animal & Veterinary",
  CTP: "Tobacco Products",
};

function inferTags(title: string, center: string): string[] {
  const tags: string[] = [];
  const lowerTitle = title.toLowerCase();

  // Add product area based on center
  if (CENTER_PRODUCT_AREAS[center]) {
    tags.push(CENTER_PRODUCT_AREAS[center]);
  }

  // Infer topic tags from title
  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    if (keywords.some((kw) => lowerTitle.includes(kw))) {
      tags.push(tag);
    }
  }

  return [...new Set(tags)];
}

function parseStatus(statusText: string): DocumentStatus {
  const upper = statusText.toUpperCase();
  if (upper.includes("DRAFT")) return "DRAFT";
  if (upper.includes("WITHDRAWN")) return "WITHDRAWN";
  if (upper.includes("SUPERSEDED")) return "SUPERSEDED";
  return "FINAL";
}

function extractDocumentId(url: string, title: string): string {
  // Try to extract UCM number from URL
  const ucmMatch = url.match(/UCM\d+/i);
  if (ucmMatch) return ucmMatch[0].toUpperCase();

  // Try media number
  const mediaMatch = url.match(/media\/(\d+)/i);
  if (mediaMatch) return `MEDIA-${mediaMatch[1]}`;

  // Generate from title
  return title
    .substring(0, 50)
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

async function scrapeSearchPage(page: Page): Promise<ScrapedDocument[]> {
  const documents: ScrapedDocument[] = [];

  // Wait for the table to load
  await page.waitForSelector("table tbody tr", { timeout: 30000 });

  // Extract data from table rows
  const rows = await page.$$eval("table tbody tr", (trs) => {
    return trs.map((tr) => {
      const cells = tr.querySelectorAll("td");
      if (cells.length < 4) return null;

      const titleCell = cells[0];
      const titleLink = titleCell.querySelector("a");
      const title = titleLink?.textContent?.trim() || titleCell.textContent?.trim() || "";
      const detailUrl = titleLink?.getAttribute("href") || "";

      const dateText = cells[1]?.textContent?.trim() || "";
      const center = cells[2]?.textContent?.trim() || "";
      const status = cells[3]?.textContent?.trim() || "";

      return { title, detailUrl, dateText, center, status };
    }).filter(Boolean);
  });

  console.log(`Found ${rows.length} rows on this page`);

  for (const row of rows) {
    if (!row || !row.title || !row.detailUrl) continue;

    try {
      // Parse date
      const issueDate = new Date(row.dateText);
      if (isNaN(issueDate.getTime())) continue;

      // Build full URL
      const fullDetailUrl = row.detailUrl.startsWith("http")
        ? row.detailUrl
        : `https://www.fda.gov${row.detailUrl}`;

      // Extract document ID
      const fdaDocumentId = extractDocumentId(fullDetailUrl, row.title);

      // Parse status
      const status = parseStatus(row.status);

      // Infer tags
      const tags = inferTags(row.title, row.center);

      documents.push({
        title: row.title,
        fdaDocumentId,
        issueDate,
        status,
        pdfUrl: "", // Will be fetched from detail page
        summary: null,
        center: row.center || "FDA",
        detailUrl: fullDetailUrl,
        tags,
      });
    } catch (error) {
      console.error(`Error processing row: ${row.title}`, error);
    }
  }

  return documents;
}

async function fetchPdfUrl(page: Page, detailUrl: string): Promise<string | null> {
  try {
    await page.goto(detailUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Look for PDF download link
    const pdfUrl = await page.evaluate(() => {
      // Try common patterns for PDF links
      const selectors = [
        'a[href*="/download"]',
        'a[href$=".pdf"]',
        'a[href*="media/"][href*="/download"]',
        ".download-link a",
        'a:contains("Download")',
      ];

      for (const selector of selectors) {
        try {
          const link = document.querySelector(selector);
          if (link) {
            const href = link.getAttribute("href");
            if (href && (href.includes("/download") || href.endsWith(".pdf"))) {
              return href;
            }
          }
        } catch {
          // Selector not supported, continue
        }
      }

      // Fallback: find any link with "download" in href
      const allLinks = document.querySelectorAll("a");
      for (const link of allLinks) {
        const href = link.getAttribute("href");
        if (href && href.includes("/download")) {
          return href;
        }
      }

      return null;
    });

    if (pdfUrl) {
      return pdfUrl.startsWith("http") ? pdfUrl : `https://www.fda.gov${pdfUrl}`;
    }

    return null;
  } catch (error) {
    console.error(`Error fetching PDF URL from ${detailUrl}:`, error);
    return null;
  }
}

async function scrapeFDADocuments(maxDocuments: number): Promise<ScrapedDocument[]> {
  console.log(`Starting FDA document scraper (limit: ${maxDocuments})`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent("FDA-Guidance-Navigator/1.0 (Educational Project)");

  const allDocuments: ScrapedDocument[] = [];
  let currentPage = 0;

  try {
    // Start at the search page
    const baseUrl = "https://www.fda.gov/regulatory-information/search-fda-guidance-documents";
    await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 60000 });

    while (allDocuments.length < maxDocuments) {
      console.log(`\nScraping page ${currentPage + 1}...`);

      const documents = await scrapeSearchPage(page);
      if (documents.length === 0) {
        console.log("No more documents found");
        break;
      }

      // Fetch PDF URLs for each document (with rate limiting)
      for (const doc of documents) {
        if (allDocuments.length >= maxDocuments) break;

        console.log(`  Fetching PDF for: ${doc.title.substring(0, 60)}...`);
        const pdfUrl = await fetchPdfUrl(page, doc.detailUrl);

        if (pdfUrl) {
          doc.pdfUrl = pdfUrl;
          allDocuments.push(doc);
          console.log(`    ✓ Found PDF: ${pdfUrl.substring(0, 60)}...`);
        } else {
          console.log(`    ✗ No PDF found`);
        }

        // Rate limiting - wait 500ms between requests
        await new Promise((r) => setTimeout(r, 500));
      }

      // Try to go to next page
      const nextButton = await page.$('a[rel="next"], .pager-next a, a:contains("Next")');
      if (nextButton) {
        await nextButton.click();
        await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 });
        currentPage++;
      } else {
        console.log("No next page button found");
        break;
      }
    }
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }

  return allDocuments;
}

async function importDocuments(documents: ScrapedDocument[]) {
  const connectionString = process.env.DATABASE_URL || "postgresql://jared@localhost:5432/fda_guidance";
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log(`\nImporting ${documents.length} documents...`);

  let imported = 0;
  let skipped = 0;

  for (const doc of documents) {
    try {
      // Get tag records
      const tagRecords = await prisma.tag.findMany({
        where: { name: { in: doc.tags } },
      });

      // Upsert document
      await prisma.guidanceDocument.upsert({
        where: { fdaDocumentId: doc.fdaDocumentId },
        update: {
          title: doc.title,
          issueDate: doc.issueDate,
          status: doc.status,
          pdfUrl: doc.pdfUrl,
          summary: doc.summary,
          center: doc.center,
          tags: {
            deleteMany: {},
            create: tagRecords.map((tag) => ({ tagId: tag.id })),
          },
        },
        create: {
          title: doc.title,
          fdaDocumentId: doc.fdaDocumentId,
          issueDate: doc.issueDate,
          status: doc.status,
          pdfUrl: doc.pdfUrl,
          summary: doc.summary,
          center: doc.center,
          tags: {
            create: tagRecords.map((tag) => ({ tagId: tag.id })),
          },
        },
      });

      imported++;
      console.log(`  ✓ Imported: ${doc.title.substring(0, 60)}...`);
    } catch (error) {
      console.error(`  ✗ Failed: ${doc.title.substring(0, 60)}...`, error);
      skipped++;
    }
  }

  await prisma.$disconnect();
  await pool.end();

  console.log(`\nImport complete: ${imported} imported, ${skipped} skipped`);
}

async function main() {
  console.log("=== FDA Guidance Document Scraper ===\n");
  console.log(`Mode: ${dryRun ? "DRY RUN (use --import to save to database)" : "IMPORT"}`);
  console.log(`Limit: ${limit} documents\n`);

  const documents = await scrapeFDADocuments(limit);

  console.log(`\n=== Scraping Complete ===`);
  console.log(`Found ${documents.length} documents with PDFs\n`);

  // Save to JSON file
  const outputFile = "scraped-fda-documents.json";
  fs.writeFileSync(outputFile, JSON.stringify(documents, null, 2));
  console.log(`Saved to ${outputFile}`);

  if (shouldImport) {
    await importDocuments(documents);
  } else {
    console.log("\nTo import these documents, run:");
    console.log("  npx tsx scripts/scrape-fda-documents.ts --import");
  }

  // Print summary
  console.log("\n=== Summary ===");
  const byCenterCount = documents.reduce((acc, doc) => {
    acc[doc.center] = (acc[doc.center] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("By Center:");
  for (const [center, count] of Object.entries(byCenterCount)) {
    console.log(`  ${center}: ${count}`);
  }

  const byStatusCount = documents.reduce((acc, doc) => {
    acc[doc.status] = (acc[doc.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log("\nBy Status:");
  for (const [status, count] of Object.entries(byStatusCount)) {
    console.log(`  ${status}: ${count}`);
  }
}

main().catch(console.error);
