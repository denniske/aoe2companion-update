import {NextApiRequest, NextApiResponse} from 'next';

export const config = {
  api: {
    responseLimit: false,
  },
}

export default async function assetEndpoint(req: NextApiRequest, res: NextApiResponse) {
  console.log();
  console.log('==> ASSET');
  console.log();
  console.log(req.headers);

  res.statusCode = 400;
  res.json({ error: 'This endpoint is just for testing.' });
  return;
}
