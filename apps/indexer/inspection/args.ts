export type InspectionArgs = {
  address?: `0x${string}`;
  json: boolean;
  limit: number;
  minutes: number;
  reason?: string;
};

const defaultArgs = {
  json: false,
  limit: 10,
  minutes: 60,
} as const;

const parsePositiveInteger = (value: string, flag: string) => {
  const parsedValue = Number(value);

  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }

  return parsedValue;
};

export const parseInspectionArgs = (argv: string[] = process.argv.slice(2)): InspectionArgs => {
  const args: InspectionArgs = { ...defaultArgs };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];

    if (flag === "--") {
      continue;
    }

    if (flag === "--json") {
      args.json = true;
      continue;
    }

    if (flag === "--minutes") {
      const value = argv[index + 1];

      if (value === undefined) {
        throw new Error("--minutes requires a value");
      }

      args.minutes = parsePositiveInteger(value, "--minutes");
      index += 1;
      continue;
    }

    if (flag === "--limit") {
      const value = argv[index + 1];

      if (value === undefined) {
        throw new Error("--limit requires a value");
      }

      args.limit = parsePositiveInteger(value, "--limit");
      index += 1;
      continue;
    }

    if (flag === "--address") {
      const value = argv[index + 1];

      if (value === undefined || !value.startsWith("0x")) {
        throw new Error("--address requires a 0x-prefixed address");
      }

      args.address = value as `0x${string}`;
      index += 1;
      continue;
    }

    if (flag === "--reason") {
      const value = argv[index + 1];

      if (value === undefined || value.length === 0) {
        throw new Error("--reason requires a value");
      }

      args.reason = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown inspection argument: ${flag}`);
  }

  return args;
};
