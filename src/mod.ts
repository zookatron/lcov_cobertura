/*
 * Copyright 2011-2022 Eric Wendelin
 * Modifications copyright 2022 Tim Zook
 *
 * This is free software, licensed under the Apache License, Version 2.0,
 * ailable in the accompanying LICENSE.txt file.
 */

import { join, sep } from "https://deno.land/std@0.167.0/path/mod.ts";
import { stringify } from "https://deno.land/x/xml@2.0.4/mod.ts";
import { Command } from "https://deno.land/x/cliffy@v0.25.5/command/mod.ts";

export interface Coverage {
  packages: Record<string, {
    linesTotal: number;
    linesCovered: number;
    branchesTotal: number;
    branchesCovered: number;
    lineRate: string;
    branchRate: string;
    classes: Record<string, {
      name: string;
      lines: Record<number, {
        branch: boolean;
        hits: number;
        branchesTotal: number;
        branchesCovered: number;
      }>;
      methods: Record<string, [string, string]>;
      linesTotal: number;
      linesCovered: number;
      branchesTotal: number;
      branchesCovered: number;
    }>;
  }>;
  summary: {
    linesTotal: number;
    linesCovered: number;
    branchesTotal: number;
    branchesCovered: number;
  };
  timestamp: string;
}

export interface Options {
  output?: string;
  baseDir: string;
  excludes?: string[];
}

/**
 * Get the percentage of lines covered in the total, with formatting.
 *
 * @param {number} linesTotal Total number of lines
 * @param {number} linesCovered Number of lines covered
 * @returns {string} The formatted coverage percentage
 */
function formatPercent(linesTotal: number, linesCovered: number) {
  return linesTotal === 0 ? "0.0" : `${linesCovered / linesTotal}`;
}

/**
 * Generate a data structure representing it that can be serialized in any
 * logical format.
 *
 * @param {object} lcovData Contents of the LCOV data file
 * @param {object} options Parsing options
 * @returns {object} The internal data structure for the coverage data
 */
export function parseLcov(lcovData: string, options: Options) {
  const excludes = (options.excludes || []).map((exclude) => new RegExp(exclude));
  const coverageData: Coverage = {
    packages: {},
    summary: { linesTotal: 0, linesCovered: 0, branchesTotal: 0, branchesCovered: 0 },
    timestamp: `${Math.floor(Date.now() / 1000)}`,
  };
  let pack: string | null = null;
  let currentFile: string | null = null;
  let fileLinesTotal = 0;
  let fileLinesCovered = 0;
  let fileLines: Record<string, {
    branch: boolean;
    hits: number;
    branchesTotal: number;
    branchesCovered: number;
  }> = {};
  let fileMethods: Record<string, [string, string]> = {};
  let fileBranchesTotal = 0;
  let fileBranchesCovered = 0;
  for (const line of lcovData.split("\n")) {
    if (line.trim() === "end_of_record") {
      if (currentFile && pack) {
        const packageDict = coverageData.packages[pack];
        packageDict.linesTotal += fileLinesTotal;
        packageDict.linesCovered += fileLinesCovered;
        packageDict.branchesTotal += fileBranchesTotal;
        packageDict.branchesCovered += fileBranchesCovered;
        const fileDict = packageDict.classes[currentFile];
        fileDict.linesTotal = fileLinesTotal;
        fileDict.linesCovered = fileLinesCovered;
        fileDict.lines = Object.assign({}, fileLines);
        fileDict.methods = Object.assign({}, fileMethods);
        fileDict.branchesTotal = fileBranchesTotal;
        fileDict.branchesCovered = fileBranchesCovered;
        coverageData.summary.linesTotal += fileLinesTotal;
        coverageData.summary.linesCovered += fileLinesCovered;
        coverageData.summary.branchesTotal += fileBranchesTotal;
        coverageData.summary.branchesCovered += fileBranchesCovered;
      }
    }
    const lineParts = line.split(":");
    const inputType = lineParts[0];
    if (inputType === "SF") {
      const fileName = lineParts.slice(-1)[0].trim();
      const relativeFileName = join(options.baseDir, fileName);
      pack = relativeFileName.split(sep).slice(0, -1).join(".");
      const className = relativeFileName.split(sep).join(".");
      if (!(pack in coverageData.packages)) {
        coverageData.packages[pack] = {
          classes: {},
          linesTotal: 0,
          linesCovered: 0,
          branchesTotal: 0,
          branchesCovered: 0,
          lineRate: "",
          branchRate: "",
        };
      }
      coverageData.packages[pack].classes[relativeFileName] = {
        name: className,
        lines: {},
        methods: {},
        linesTotal: 0,
        linesCovered: 0,
        branchesTotal: 0,
        branchesCovered: 0,
      };
      currentFile = relativeFileName;
      fileLinesTotal = 0;
      fileLinesCovered = 0;
      fileLines = {};
      fileMethods = {};
      fileBranchesTotal = 0;
      fileBranchesCovered = 0;
    } else if (inputType === "DA") {
      const [lineNumberString, lineHitsString] = lineParts.slice(-1)[0].trim().split(",").slice(0, 2);
      const lineNumber = Number.parseInt(lineNumberString);
      if (!(lineNumber in fileLines)) {
        fileLines[lineNumber] = { branch: false, hits: 0, branchesTotal: 0, branchesCovered: 0 };
      }
      const lineHits = Number.parseInt(lineHitsString);
      if (!Number.isNaN(lineHits) && lineHits > 0) {
        fileLines[lineNumber].hits = lineHits;
        fileLinesCovered += 1;
      }
      fileLinesTotal += 1;
    } else if (inputType === "BRDA") {
      const [lineNumberString, _blockNumber, _branchNumber, branchHits] = lineParts.slice(-1)[0].trim().split(",");
      const lineNumber = Number.parseInt(lineNumberString);
      if (!(lineNumber in fileLines)) {
        fileLines[lineNumber] = { branch: true, branchesTotal: 0, branchesCovered: 0, hits: 0 };
      }
      fileLines[lineNumber].branch = true;
      fileLines[lineNumber].branchesTotal += 1;
      fileBranchesTotal += 1;
      if (branchHits !== "-" && Number.parseInt(branchHits) > 0) {
        fileLines[lineNumber].branchesCovered += 1;
        fileBranchesCovered += 1;
      }
    } else if (inputType === "BRF") {
      fileBranchesTotal = Number.parseInt(lineParts[1]);
    } else if (inputType === "BRH") {
      fileBranchesCovered = Number.parseInt(lineParts[1]);
    } else if (inputType === "FN") {
      const [functionLine, ...functionNameParts] = lineParts.slice(-1)[0].trim().split(",");
      const functionName = functionNameParts.join(",");
      fileMethods[functionName] = [functionLine, "0"];
    } else if (inputType === "FNDA") {
      const [functionHits, ...functionHitParts] = lineParts.slice(-1)[0].trim().split(",");
      const functionName = functionHitParts.join(",");
      if (!(functionName in fileMethods)) {
        fileMethods[functionName] = ["0", "0"];
      }
      fileMethods[functionName][1] = functionHits;
    }
  }

  for (const packageName in coverageData.packages) {
    if (excludes.some((exclude) => exclude.test(packageName))) {
      delete coverageData.packages[packageName];
    }
  }

  for (const packageData of Object.values(coverageData.packages)) {
    packageData.lineRate = formatPercent(packageData.linesTotal, packageData.linesCovered);
    packageData.branchRate = formatPercent(packageData.branchesTotal, packageData.branchesCovered);
  }
  return coverageData;
}

/**
 * Given parsed coverage data, return a string Cobertura XML representation.
 *
 * @param {object} coverageData Parsed coverage data
 * @param {object} options Generation options
 * @returns {string} The Cobertura XML data
 */
export function generateCoberturaXml(coverageData: Coverage, options: Options) {
  const xml = {
    coverage: {
      "@branch-rate": formatPercent(coverageData.summary.branchesTotal, coverageData.summary.branchesCovered),
      "@branches-covered": coverageData.summary.branchesCovered.toString(),
      "@branches-valid": coverageData.summary.branchesTotal.toString(),
      "@complexity": "0",
      "@line-rate": formatPercent(coverageData.summary.linesTotal, coverageData.summary.linesCovered),
      "@lines-covered": coverageData.summary.linesCovered.toString(),
      "@lines-valid": coverageData.summary.linesTotal.toString(),
      "@timestamp": coverageData.timestamp,
      "@version": "2.0.3",
      sources: { source: { "#text": options.baseDir } },
      packages: {
        package: Object.entries(coverageData.packages).map(([packageName, packageData]) => ({
          "@line-rate": packageData.lineRate,
          "@branch-rate": packageData.branchRate,
          "@name": packageName,
          "@complexity": "0",
          classes: {
            class: Object.entries(packageData.classes).map(([className, classData]) => ({
              "@branch-rate": formatPercent(classData.branchesTotal, classData.branchesCovered),
              "@line-rate": formatPercent(classData.linesTotal, classData.linesCovered),
              "@complexity": "0",
              "@filename": className,
              "@name": classData.name,
              methods: {
                method: Object.entries(classData.methods).map(([methodName, [line, hits]]) => ({
                  "@name": methodName,
                  "@signature": "",
                  "@line-rate": ((Number.parseInt(hits) > 0) ? "1.0" : "0.0"),
                  "@branch-rate": ((Number.parseInt(hits) > 0) ? "1.0" : "0.0"),
                  lines: { line: { "@hits": hits, "@number": line, "@branch": "false" } },
                })),
              },
              lines: {
                line: Object.keys(classData.lines).map((lineNumber) => Number.parseInt(lineNumber)).sort((a, b) => a - b).map(
                  (lineNumber) => {
                    const total = Math.floor(classData.lines[lineNumber].branchesTotal);
                    const covered = Math.floor(classData.lines[lineNumber].branchesCovered);
                    const percentage = Math.floor((covered * 100.0) / total);
                    return Object.assign({
                      "@branch": classData.lines[lineNumber].branch ? "true" : "false",
                      "@hits": classData.lines[lineNumber].hits.toString(),
                      "@number": lineNumber.toString(),
                    }, classData.lines[lineNumber].branch ? { "@condition-coverage": `${percentage}% (${covered}/${total})` } : {});
                  },
                ),
              },
            })),
          },
        })),
      },
    },
  };
  return `<?xml version="1.0" ?>\n<!DOCTYPE coverage\n  SYSTEM 'http://cobertura.sourceforge.net/xml/coverage-04.dtd'>\n${stringify(xml)}`;
}

/**
 * Outputs the content to the command line or a file based on the provided options.
 *
 * @param {string} content The content to output
 * @param {object} options Output options
 * @returns {Promise} The output process promise
 */
export async function output(content: string, options: Options) {
  options.output ? await Deno.writeTextFile(options.output, content) : console.log(content);
}

/**
 * Converts code coverage report files in LCOV format to Cobertura's XML
 * report format so that CI servers like Jenkins can aggregate results and
 * determine build stability etc.
 *
 * @param {string[]} args Command line arguments
 * @returns {Promise} The main process promise
 */
export function main(args?: string[]) {
  new Command()
    .name("lcov_cobertura")
    .version("1.0.0")
    .description("Converts LCOV output to Cobertura-compatible XML")
    .option("-b, --base-dir <baseDir:file>", "Directory where source files are located", { default: "." })
    .option("-e, --excludes <excludes:string[]>", "Comma-separated list of regexes of packages to exclude")
    .option("-o, --output <output:file>", "Path to store Cobertura XML file")
    .arguments("<file>")
    .action(async (options, file) => output(generateCoberturaXml(parseLcov(await Deno.readTextFile(file), options), options), options))
    .parse(args);
}
