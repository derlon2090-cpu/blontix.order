import 'server-only';
import {drizzle} from 'drizzle-orm/node-postgres';
import {getPool} from '@/lib/providers.mjs';
import * as schema from './schema';
export function getDb(){return drizzle(getPool(),{schema});}
