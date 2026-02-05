/**
 * FDA Guidance Document Importer
 *
 * This script fetches FDA guidance documents from the FDA website and imports them
 * into the local database. It also creates the FDA-defined tags.
 *
 * Usage: npx tsx scripts/import-fda-documents.ts
 */

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, TagCategory, DocumentStatus } from "@prisma/client";
import * as cheerio from "cheerio";

// Initialize Prisma client
const connectionString = process.env.DATABASE_URL || "postgresql://jared@localhost:5432/fda_guidance";
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// FDA Centers
const FDA_CENTERS = [
  { code: "CDER", name: "Center for Drug Evaluation and Research" },
  { code: "CBER", name: "Center for Biologics Evaluation and Research" },
  { code: "CDRH", name: "Center for Devices and Radiological Health" },
  { code: "CFSAN", name: "Center for Food Safety and Applied Nutrition" },
  { code: "CVM", name: "Center for Veterinary Medicine" },
  { code: "CTP", name: "Center for Tobacco Products" },
  { code: "ORA", name: "Office of Regulatory Affairs" },
  { code: "NCTR", name: "National Center for Toxicological Research" },
  { code: "OC", name: "Office of the Commissioner" },
];

// FDA-defined tags by category
const FDA_TAGS = {
  PRODUCT_AREA: [
    "Drugs",
    "Biologics",
    "Medical Devices",
    "Food & Dietary Supplements",
    "Cosmetics",
    "Tobacco Products",
    "Animal & Veterinary",
    "Combination Products",
  ],
  TOPIC: [
    "Clinical Trials",
    "Chemistry, Manufacturing, and Controls (CMC)",
    "Good Manufacturing Practice (GMP)",
    "Labeling",
    "Quality Systems",
    "Bioequivalence",
    "Safety Reporting",
    "Preclinical Studies",
    "Postmarket Surveillance",
    "Regulatory Submissions",
    "Drug Development",
    "Device Classification",
    "Pediatric Development",
    "Orphan Drugs",
    "Biosimilars",
    "Generic Drugs",
    "OTC Drugs",
    "Prescription Drugs",
    "COVID-19",
    "Digital Health",
    "Artificial Intelligence",
    "Cellular & Gene Therapy",
    "Nanotechnology",
    "3D Printing",
  ],
  REGULATORY_TYPE: [
    "Procedural",
    "Scientific/Technical",
    "Compliance Policy",
    "Industry Guidance",
    "Staff Guidance",
  ],
};

interface GuidanceDocument {
  title: string;
  fdaDocumentId: string;
  issueDate: Date;
  status: DocumentStatus;
  pdfUrl: string;
  summary: string | null;
  center: string;
  tags: string[];
}

async function createTags() {
  console.log("Creating FDA-defined tags...");

  for (const [category, tagNames] of Object.entries(FDA_TAGS)) {
    for (const name of tagNames) {
      await prisma.tag.upsert({
        where: { name },
        update: {},
        create: {
          name,
          category: category as TagCategory,
        },
      });
    }
  }

  console.log("Tags created successfully.");
}

async function fetchGuidanceDocumentsFromFDA(): Promise<GuidanceDocument[]> {
  console.log("Fetching guidance documents from FDA...");

  // The FDA guidance search page uses a server-rendered table
  // We'll fetch the main page and parse the table data
  const baseUrl = "https://www.fda.gov/regulatory-information/search-fda-guidance-documents";

  try {
    const response = await fetch(baseUrl, {
      headers: {
        "User-Agent": "FDA-Guidance-Navigator/1.0 (Educational Project)",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch FDA page: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // The FDA page uses a dynamic table, so we may need to parse embedded JSON
    // or fetch from their JSON endpoint
    const documents: GuidanceDocument[] = [];

    // Try to find the Views JSON data embedded in the page
    const scripts = $("script").toArray();
    for (const script of scripts) {
      const content = $(script).html() || "";
      if (content.includes("datatables") || content.includes("guidance")) {
        // Look for embedded data
        const jsonMatch = content.match(/var\s+\w+\s*=\s*(\[[\s\S]*?\]);/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            console.log(`Found embedded data with ${data.length} entries`);
          } catch {
            // Not valid JSON
          }
        }
      }
    }

    // If we can't find embedded data, parse the table directly
    $("table tbody tr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td");

      if (cells.length >= 4) {
        const titleCell = $(cells[0]);
        const title = titleCell.text().trim();
        const link = titleCell.find("a").attr("href");

        const dateStr = $(cells[1]).text().trim();
        const centerCode = $(cells[2]).text().trim();
        const statusStr = $(cells[3]).text().trim().toUpperCase();

        if (title && link) {
          const issueDate = new Date(dateStr);
          if (isNaN(issueDate.getTime())) {
            return; // Skip invalid dates
          }

          let status: DocumentStatus = "FINAL";
          if (statusStr.includes("DRAFT")) {
            status = "DRAFT";
          } else if (statusStr.includes("WITHDRAWN")) {
            status = "WITHDRAWN";
          } else if (statusStr.includes("SUPERSEDED")) {
            status = "SUPERSEDED";
          }

          // Generate a document ID from the title
          const fdaDocumentId = title
            .substring(0, 50)
            .replace(/[^a-zA-Z0-9]/g, "-")
            .toLowerCase();

          // Determine PDF URL
          const pdfUrl = link.startsWith("http") ? link : `https://www.fda.gov${link}`;

          // Assign tags based on title keywords
          const tags = inferTagsFromTitle(title, centerCode);

          documents.push({
            title,
            fdaDocumentId,
            issueDate,
            status,
            pdfUrl,
            summary: null,
            center: centerCode || "FDA",
            tags,
          });
        }
      }
    });

    console.log(`Parsed ${documents.length} documents from FDA page`);
    return documents;
  } catch (error) {
    console.error("Error fetching FDA documents:", error);
    return [];
  }
}

function inferTagsFromTitle(title: string, center: string): string[] {
  const tags: string[] = [];
  const lowerTitle = title.toLowerCase();

  // Product area inference
  if (center === "CDER" || lowerTitle.includes("drug")) {
    tags.push("Drugs");
  }
  if (center === "CBER" || lowerTitle.includes("biologic") || lowerTitle.includes("vaccine")) {
    tags.push("Biologics");
  }
  if (center === "CDRH" || lowerTitle.includes("device") || lowerTitle.includes("medical device")) {
    tags.push("Medical Devices");
  }
  if (center === "CFSAN" || lowerTitle.includes("food") || lowerTitle.includes("dietary")) {
    tags.push("Food & Dietary Supplements");
  }
  if (center === "CVM" || lowerTitle.includes("veterinary") || lowerTitle.includes("animal")) {
    tags.push("Animal & Veterinary");
  }
  if (center === "CTP" || lowerTitle.includes("tobacco")) {
    tags.push("Tobacco Products");
  }

  // Topic inference
  if (lowerTitle.includes("clinical trial") || lowerTitle.includes("clinical study")) {
    tags.push("Clinical Trials");
  }
  if (lowerTitle.includes("cmc") || lowerTitle.includes("chemistry") || lowerTitle.includes("manufacturing")) {
    tags.push("Chemistry, Manufacturing, and Controls (CMC)");
  }
  if (lowerTitle.includes("gmp") || lowerTitle.includes("good manufacturing")) {
    tags.push("Good Manufacturing Practice (GMP)");
  }
  if (lowerTitle.includes("label")) {
    tags.push("Labeling");
  }
  if (lowerTitle.includes("quality")) {
    tags.push("Quality Systems");
  }
  if (lowerTitle.includes("bioequivalence") || lowerTitle.includes("bioavailability")) {
    tags.push("Bioequivalence");
  }
  if (lowerTitle.includes("safety") || lowerTitle.includes("adverse")) {
    tags.push("Safety Reporting");
  }
  if (lowerTitle.includes("preclinical") || lowerTitle.includes("nonclinical")) {
    tags.push("Preclinical Studies");
  }
  if (lowerTitle.includes("postmarket")) {
    tags.push("Postmarket Surveillance");
  }
  if (lowerTitle.includes("submission") || lowerTitle.includes("nda") || lowerTitle.includes("anda") || lowerTitle.includes("bla")) {
    tags.push("Regulatory Submissions");
  }
  if (lowerTitle.includes("pediatric") || lowerTitle.includes("children")) {
    tags.push("Pediatric Development");
  }
  if (lowerTitle.includes("orphan")) {
    tags.push("Orphan Drugs");
  }
  if (lowerTitle.includes("biosimilar")) {
    tags.push("Biosimilars");
  }
  if (lowerTitle.includes("generic")) {
    tags.push("Generic Drugs");
  }
  if (lowerTitle.includes("over-the-counter") || lowerTitle.includes("otc")) {
    tags.push("OTC Drugs");
  }
  if (lowerTitle.includes("covid") || lowerTitle.includes("coronavirus") || lowerTitle.includes("sars-cov")) {
    tags.push("COVID-19");
  }
  if (lowerTitle.includes("digital") || lowerTitle.includes("software") || lowerTitle.includes("mobile")) {
    tags.push("Digital Health");
  }
  if (lowerTitle.includes("artificial intelligence") || lowerTitle.includes("machine learning") || lowerTitle.includes(" ai ")) {
    tags.push("Artificial Intelligence");
  }
  if (lowerTitle.includes("cell") || lowerTitle.includes("gene therap")) {
    tags.push("Cellular & Gene Therapy");
  }

  return [...new Set(tags)]; // Remove duplicates
}

async function importDocuments(documents: GuidanceDocument[]) {
  console.log(`Importing ${documents.length} documents...`);

  let imported = 0;
  let skipped = 0;

  for (const doc of documents) {
    try {
      // Get tag IDs
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
            create: tagRecords.map((tag) => ({
              tagId: tag.id,
            })),
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
            create: tagRecords.map((tag) => ({
              tagId: tag.id,
            })),
          },
        },
      });

      imported++;
      if (imported % 50 === 0) {
        console.log(`Imported ${imported} documents...`);
      }
    } catch (error) {
      console.error(`Error importing document "${doc.title}":`, error);
      skipped++;
    }
  }

  console.log(`Import complete: ${imported} imported, ${skipped} skipped`);
}

// Create sample documents for testing when FDA scraping doesn't work
async function createSampleDocuments() {
  console.log("Creating sample documents for testing...");

  const sampleDocuments: GuidanceDocument[] = [
    {
      title: "Guidance for Industry: Clinical Trial Endpoints for the Approval of Cancer Drugs and Biologics",
      fdaDocumentId: "UCM071590",
      issueDate: new Date("2018-12-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/71195/download",
      summary: "This guidance provides recommendations on the endpoints that the FDA considers acceptable to support approval of drugs and biologics intended to treat cancer.",
      center: "CDER",
      tags: ["Drugs", "Biologics", "Clinical Trials"],
    },
    {
      title: "Guidance for Industry: Process Validation: General Principles and Practices",
      fdaDocumentId: "UCM070336",
      issueDate: new Date("2011-01-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/71021/download",
      summary: "This guidance outlines general principles and approaches that FDA considers appropriate elements of process validation for the manufacture of human and animal drug and biological products.",
      center: "CDER",
      tags: ["Drugs", "Good Manufacturing Practice (GMP)", "Quality Systems"],
    },
    {
      title: "Guidance for Industry: Bioanalytical Method Validation",
      fdaDocumentId: "UCM368107",
      issueDate: new Date("2018-05-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/70858/download",
      summary: "This guidance provides recommendations for bioanalytical method validation. It also addresses the application of bioanalytical method validation to bioavailability, bioequivalence, and pharmacokinetic studies.",
      center: "CDER",
      tags: ["Drugs", "Bioequivalence", "Preclinical Studies"],
    },
    {
      title: "Guidance for Industry: FDA's Real-World Evidence Program",
      fdaDocumentId: "UCM587749",
      issueDate: new Date("2023-08-01"),
      status: "DRAFT",
      pdfUrl: "https://www.fda.gov/media/146258/download",
      summary: "This guidance describes FDA's framework for evaluating the potential use of real-world data to generate real-world evidence to support regulatory decisions for drugs and biologics.",
      center: "CDER",
      tags: ["Drugs", "Biologics", "Clinical Trials", "Digital Health"],
    },
    {
      title: "Guidance for Industry: Artificial Intelligence and Machine Learning in Drug Development",
      fdaDocumentId: "UCM665899",
      issueDate: new Date("2024-01-15"),
      status: "DRAFT",
      pdfUrl: "https://www.fda.gov/media/166434/download",
      summary: "This guidance provides FDA's current thinking on the use of artificial intelligence and machine learning in drug development, including considerations for regulatory submissions.",
      center: "CDER",
      tags: ["Drugs", "Artificial Intelligence", "Drug Development", "Regulatory Submissions"],
    },
    {
      title: "Guidance for Industry: Generic Drug Development - Recommendations for Bioequivalence Studies",
      fdaDocumentId: "UCM702237",
      issueDate: new Date("2019-06-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/128793/download",
      summary: "This guidance provides general recommendations for conducting bioequivalence studies for generic drug products.",
      center: "CDER",
      tags: ["Drugs", "Generic Drugs", "Bioequivalence"],
    },
    {
      title: "Guidance for Industry: Pediatric Study Plans: Content of and Process for Submitting Initial Pediatric Study Plans and Amended Initial Pediatric Study Plans",
      fdaDocumentId: "UCM360507",
      issueDate: new Date("2020-03-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/86340/download",
      summary: "This guidance provides recommendations on the content and process for submitting pediatric study plans to FDA.",
      center: "CDER",
      tags: ["Drugs", "Pediatric Development", "Regulatory Submissions"],
    },
    {
      title: "Guidance for Industry: Biosimilar Development and the BPCI Act",
      fdaDocumentId: "UCM259797",
      issueDate: new Date("2015-04-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/89023/download",
      summary: "This guidance provides an overview of FDA's interpretation of the statutory authority under the BPCI Act for the licensure of biosimilar products.",
      center: "CBER",
      tags: ["Biologics", "Biosimilars", "Regulatory Submissions"],
    },
    {
      title: "Guidance for Industry: COVID-19: Developing Drugs and Biological Products for Treatment or Prevention",
      fdaDocumentId: "UCM705564",
      issueDate: new Date("2021-02-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/137926/download",
      summary: "This guidance provides recommendations for the development of drugs and biological products for the treatment or prevention of COVID-19.",
      center: "CDER",
      tags: ["Drugs", "Biologics", "COVID-19", "Clinical Trials", "Drug Development"],
    },
    {
      title: "Guidance for Industry: Quality Considerations for Continuous Manufacturing",
      fdaDocumentId: "UCM632567",
      issueDate: new Date("2019-02-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/121314/download",
      summary: "This guidance provides recommendations for the implementation of continuous manufacturing for drug substance and drug product manufacturing.",
      center: "CDER",
      tags: ["Drugs", "Chemistry, Manufacturing, and Controls (CMC)", "Good Manufacturing Practice (GMP)", "Quality Systems"],
    },
    {
      title: "Guidance for Industry: Software as a Medical Device (SaMD): Clinical Evaluation",
      fdaDocumentId: "CDRH-UCM587749",
      issueDate: new Date("2017-12-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/100714/download",
      summary: "This guidance describes a risk-based approach to clinical evaluation of software as a medical device.",
      center: "CDRH",
      tags: ["Medical Devices", "Digital Health", "Clinical Trials"],
    },
    {
      title: "Guidance for Industry: Cybersecurity in Medical Devices",
      fdaDocumentId: "CDRH-UCM623529",
      issueDate: new Date("2023-09-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/119933/download",
      summary: "This guidance provides recommendations for managing cybersecurity risks in medical devices throughout their lifecycle.",
      center: "CDRH",
      tags: ["Medical Devices", "Digital Health", "Quality Systems"],
    },
    {
      title: "Guidance for Industry: Cell and Gene Therapy Guidances",
      fdaDocumentId: "CBER-UCM632567",
      issueDate: new Date("2022-06-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/vaccines-blood-biologics/cellular-gene-therapy-products/cell-and-gene-therapy-guidances",
      summary: "This guidance provides recommendations for the development and manufacture of cellular and gene therapy products.",
      center: "CBER",
      tags: ["Biologics", "Cellular & Gene Therapy", "Good Manufacturing Practice (GMP)"],
    },
    {
      title: "Guidance for Industry: Food Labeling - Nutrition Labeling of Standard Menu Items",
      fdaDocumentId: "CFSAN-UCM535563",
      issueDate: new Date("2016-05-01"),
      status: "FINAL",
      pdfUrl: "https://www.fda.gov/media/89809/download",
      summary: "This guidance provides recommendations for nutrition labeling of standard menu items in restaurants and similar retail food establishments.",
      center: "CFSAN",
      tags: ["Food & Dietary Supplements", "Labeling"],
    },
    {
      title: "Draft Guidance for Industry: 3D Printing of Medical Devices",
      fdaDocumentId: "CDRH-UCM482422",
      issueDate: new Date("2024-03-01"),
      status: "DRAFT",
      pdfUrl: "https://www.fda.gov/media/97633/download",
      summary: "This guidance provides recommendations for manufacturers of medical devices made using 3D printing technology.",
      center: "CDRH",
      tags: ["Medical Devices", "3D Printing", "Good Manufacturing Practice (GMP)"],
    },
  ];

  await importDocuments(sampleDocuments);
}

async function main() {
  try {
    console.log("Starting FDA Guidance Document Import\n");

    // Step 1: Create tags
    await createTags();

    // Step 2: Try to fetch from FDA
    const documents = await fetchGuidanceDocumentsFromFDA();

    if (documents.length > 0) {
      // Step 3: Import fetched documents
      await importDocuments(documents);
    } else {
      // Fall back to sample documents
      console.log("\nNo documents fetched from FDA. Creating sample documents...\n");
      await createSampleDocuments();
    }

    // Print summary
    const totalDocs = await prisma.guidanceDocument.count();
    const totalTags = await prisma.tag.count();

    console.log("\n=== Import Summary ===");
    console.log(`Total documents: ${totalDocs}`);
    console.log(`Total tags: ${totalTags}`);
  } catch (error) {
    console.error("Import failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
