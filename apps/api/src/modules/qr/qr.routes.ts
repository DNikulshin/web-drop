import { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';

export async function qrRoutes(server: FastifyInstance) {
  server.get('/api/qr', {
    schema: {
      summary: 'Generate QR code for session or file',
      querystring: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['session', 'file'] },
          code: { type: 'string' },
        },
        required: ['kind', 'code'],
      },
      response: {
        200: { description: 'PNG image stream' },
      },
    },
  }, async (request, reply) => {
    const qs = request.query as { kind: 'session' | 'file'; code: string };
    const host = (request.headers['x-forwarded-host'] || request.headers.host) as string | undefined;
    const proto = (request.headers['x-forwarded-proto'] || 'http') as string;
    const base = host ? `${proto}://${host}` : (process.env.FRONTEND_URL || 'http://localhost:3001');
    let target = '';
    if (qs.kind === 'file') {
      target = `${base}/files/${qs.code}`;
    } else {
      // session link — point to frontend with session code
      const frontend = process.env.FRONTEND_URL || `${base}`;
      target = `${frontend}/?session=${qs.code}`;
    }

    try {
      const buffer = await QRCode.toBuffer(target, { type: 'png' });
      reply.type('image/png');
      return reply.send(buffer);
    } catch (err) {
      server.log.error(err);
      return (reply as any).code(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Unable to generate QR' });
    }
  });
}
