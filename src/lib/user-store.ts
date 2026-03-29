import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";

type StoredUser = {
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

type UsersFile = {
  users: StoredUser[];
};

const usersDirectory = path.join(process.cwd(), ".data");
const usersFilePath = path.join(usersDirectory, "users.json");

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

async function ensureUsersFile(): Promise<void> {
  await fs.mkdir(usersDirectory, { recursive: true });

  try {
    await fs.access(usersFilePath);
  } catch {
    const empty: UsersFile = { users: [] };
    await fs.writeFile(usersFilePath, JSON.stringify(empty, null, 2), "utf8");
  }
}

async function readUsersFile(): Promise<UsersFile> {
  await ensureUsersFile();
  const raw = await fs.readFile(usersFilePath, "utf8");

  try {
    const parsed = JSON.parse(raw) as UsersFile;
    if (!Array.isArray(parsed.users)) {
      return { users: [] };
    }

    return {
      users: parsed.users.filter(
        (user) =>
          typeof user.email === "string" &&
          typeof user.passwordHash === "string" &&
          typeof user.salt === "string",
      ),
    };
  } catch {
    return { users: [] };
  }
}

async function writeUsersFile(usersFile: UsersFile): Promise<void> {
  await ensureUsersFile();
  await fs.writeFile(usersFilePath, JSON.stringify(usersFile, null, 2), "utf8");
}

function constantTimeStringEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function registerUser(email: string, password: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const usersFile = await readUsersFile();

  const exists = usersFile.users.some(
    (user) => normalizeEmail(user.email) === normalizedEmail,
  );

  if (exists) {
    throw new Error("User already exists");
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);

  usersFile.users.push({
    email: normalizedEmail,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  });

  await writeUsersFile(usersFile);
}

export async function verifyUserCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  const usersFile = await readUsersFile();

  const user = usersFile.users.find(
    (entry) => normalizeEmail(entry.email) === normalizedEmail,
  );

  if (!user) {
    return false;
  }

  const computedHash = hashPassword(password, user.salt);
  return constantTimeStringEquals(computedHash, user.passwordHash);
}
