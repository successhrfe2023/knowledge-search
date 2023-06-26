import { createKysely } from '@vercel/postgres-kysely';

const db = createKysely();

export default db