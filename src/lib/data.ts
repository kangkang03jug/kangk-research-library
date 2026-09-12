import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';
import {
  PaperSchema,
  UserStateSchema,
  DailySchema,
  type Paper,
  type UserState,
  type DailyArchive,
} from './schema';

const root = path.resolve(process.cwd());
function readJsonDir<T>(relative: string, schema: { parse: (value: unknown) => T }) {
  const dir = path.join(root, relative);
  if (!fs.existsSync(dir)) return [] as T[];
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => schema.parse(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))));
}
export function getProfile() {
  return yaml.load(fs.readFileSync(path.join(root, 'config/research-profile.yaml'), 'utf8')) as any;
}
export function getPapers(): Paper[] {
  return readJsonDir('data/papers', PaperSchema);
}
export function getStates(): UserState[] {
  return readJsonDir('data/user', UserStateSchema);
}
export function getDaily(): DailyArchive[] {
  return readJsonDir('data/daily', DailySchema);
}
