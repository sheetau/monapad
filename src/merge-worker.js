import { computeMerge } from "./merge-computation.mjs";
self.onmessage = ({ data }) => {
  try { self.postMessage({ plan: computeMerge(data.base, data.local, data.disk) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
