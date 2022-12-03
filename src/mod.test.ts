import { assert, assertEquals } from "https://deno.land/std@0.167.0/testing/asserts.ts";
import { generateCoberturaXml, parseLcov } from "./mod.ts";
import { dirname, fromFileUrl, resolve } from "https://deno.land/std@0.167.0/path/mod.ts";

const testDataDir = resolve(dirname(fromFileUrl(import.meta.url)), "../test");
const defaultOptions = { baseDir: "." };

Deno.test("parse lcov", async (test) => {
  await test.step("parses basic", () => {
    const result = parseLcov("SF:foo/file.ext\nDA:1,1\nDA:2,0\nBRDA:1,1,1,1\nBRDA:1,1,2,0\nend_of_record\n", defaultOptions);
    assert("packages" in result);
    assert("foo" in result.packages);
    assertEquals(result.packages.foo.branchesCovered, 1);
    assertEquals(result.packages.foo.branchesTotal, 2);
    assertEquals(result.packages.foo.branchRate, "0.5");
    assertEquals(result.packages.foo.lineRate, "0.5");
    assertEquals(result.packages.foo.linesCovered, 1);
    assertEquals(result.packages.foo.linesTotal, 2);
    assertEquals(result.packages.foo.classes["foo/file.ext"].branchesCovered, 1);
    assertEquals(result.packages.foo.classes["foo/file.ext"].branchesTotal, 2);
    assertEquals(result.packages.foo.classes["foo/file.ext"].methods, {});
  });
  await test.step("parses with functions", () => {
    const result = parseLcov(
      "TN:\nSF:foo/file.ext\nDA:1,1\nDA:2,0\nFN:1,(anonymous_1)\nFN:2,namedFn\nFNDA:1,(anonymous_1)\nend_of_record\n",
      defaultOptions,
    );
    assertEquals(result.packages.foo.lineRate, "0.5");
    assertEquals(result.packages.foo.linesCovered, 1);
    assertEquals(result.packages.foo.linesTotal, 2);
    assertEquals(result.packages.foo.classes["foo/file.ext"].methods["(anonymous_1)"], ["1", "1"]);
    assertEquals(result.packages.foo.classes["foo/file.ext"].methods["namedFn"], ["2", "0"]);
  });
  await test.step("parses with checksum", () => {
    const result = parseLcov("SF:foo/file.ext\nDA:1,1,dummychecksum\nDA:2,0,dummychecksum\nBRDA:1,1,1,1\nBRDA:1,1,2,0\nend_of_record\n", {
      baseDir: ".",
    });
    assert("packages" in result);
    assert("foo" in result.packages);
    assertEquals(result.packages.foo.branchesCovered, 1);
    assertEquals(result.packages.foo.branchesTotal, 2);
    assertEquals(result.packages.foo.branchRate, "0.5");
    assertEquals(result.packages.foo.lineRate, "0.5");
    assertEquals(result.packages.foo.linesCovered, 1);
    assertEquals(result.packages.foo.linesTotal, 2);
    assertEquals(result.packages.foo.classes["foo/file.ext"].branchesCovered, 1);
    assertEquals(result.packages.foo.classes["foo/file.ext"].branchesTotal, 2);
    assertEquals(result.packages.foo.classes["foo/file.ext"].methods, {});
  });
  await test.step("parses function names with commas", () => {
    const result = parseLcov(
      "TN:\nSF:foo/file.ext\nDA:1,1\nDA:2,0\nFN:1,(anonymous_1<foo, bar>)\nFN:2,namedFn\nFNDA:1,(anonymous_1<foo, bar>)\nend_of_record\n",
      defaultOptions,
    );
    assertEquals(result.packages.foo.classes["foo/file.ext"].methods["(anonymous_1<foo, bar>)"], ["1", "1"]);
    assertEquals(result.packages.foo.classes["foo/file.ext"].methods["namedFn"], ["2", "0"]);
  });
  await test.step("excludes package from parser", () => {
    const result = parseLcov("SF:foo/file.ext\nDA:1,1\nDA:2,0\nend_of_record\nSF:bar/file.ext\nDA:1,1\nDA:2,1\nend_of_record\n", {
      baseDir: ".",
      excludes: ["foo"],
    });
    assert(!("foo" in result.packages));
    assert("bar" in result.packages);
    assertEquals(result.packages["bar"].lineRate, "1");
  });
  await test.step("treats non-integer line execution count as zero", () => {
    const result = parseLcov("SF:foo/file.ext\nDA:1,=====\nDA:2,2\nBRDA:1,1,1,1\nBRDA:1,1,2,0\nend_of_record\n", defaultOptions);
    assertEquals(result.packages.foo.linesCovered, 1);
    assertEquals(result.packages.foo.linesTotal, 2);
  });
});

Deno.test("generate cobertura xml", async (test) => {
  await test.step("generates basic", async () => {
    const input = await Deno.readTextFile(`${testDataDir}/basic.json`);
    const expected = await Deno.readTextFile(`${testDataDir}/basic.xml`);
    const generated = generateCoberturaXml(JSON.parse(input), defaultOptions);
    assertEquals(generated, expected);
  });

  await test.step("generates advanced", async () => {
    const input = parseLcov(await Deno.readTextFile(`${testDataDir}/advanced.lcov`), defaultOptions);
    input.timestamp = "1670106073";
    const expected = await Deno.readTextFile(`${testDataDir}/advanced.xml`);
    const generated = generateCoberturaXml(input, defaultOptions);
    assertEquals(generated, expected);
  });
});
