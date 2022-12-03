import { main } from "./src/mod.ts";

if (import.meta.main) {
  main(Deno.args);
}
