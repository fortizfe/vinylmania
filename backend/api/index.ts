import 'dotenv/config';

import { createApp } from '../src/app';

// Vercel's Node runtime accepts a standard (req, res) handler — an Express
// app already is one, so it can be exported directly as the Serverless
// Function entry point (see research.md §8).
export default createApp();
