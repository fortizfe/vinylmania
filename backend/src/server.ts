import 'dotenv/config';

import { createApp } from './app';

const port = Number(process.env.PORT) || 3001;

createApp().listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Vinylmania backend listening on port ${port}`);
});
