import {Prisma, PrismaClient} from "@prisma/client";


export async function upsertMany<T>(
    prisma: PrismaClient,
    table: string,
    identityColumns: string[],
    items: T[],
    onConflictUpdateWhere?: any,
    ignoredKeys: string[] = [],
) {
    if (items.length === 0) return;

    const completeKeys: string[] = Object.keys(items[0] as any);

    const updateFieldsMapper = (item: any) => {
        return Prisma.sql`(${Prisma.join(
            completeKeys.map((key: string) => item[key])
        )})`;
    };

    const insertKeys = completeKeys.map((key) =>
        key.toLocaleLowerCase() !== key ? `"${key}"` : `${key}`
    );
    let insertValues = items.map((item) => updateFieldsMapper(item));

    const updateSet = completeKeys.reduce((updateSet: string[], key: string) => {
        if (!identityColumns.includes(key) && !ignoredKeys.includes(key)) {
            updateSet.push(`"${key}" = EXCLUDED."${key}"`);
        }
        return updateSet;
    }, []);

    // console.log('items');
    // console.log(insertValues);

    // Capture stack trace here because it gets lost in prisma.$executeRaw
    const stackTrace = new Error().stack;

    try {
        if (updateSet.length > 0) {
            return await prisma.$executeRaw`
              INSERT INTO ${Prisma.raw(table)} (${Prisma.raw(insertKeys.join(","))})
              VALUES ${Prisma.join(insertValues)}
              ON CONFLICT (${Prisma.raw(identityColumns.join(', '))})
              DO UPDATE SET ${Prisma.raw(updateSet.join(","))}
              ${onConflictUpdateWhere ? onConflictUpdateWhere : Prisma.empty};
          `;
        } else {
            return await prisma.$executeRaw`
              INSERT INTO ${Prisma.raw(table)} (${Prisma.raw(insertKeys.join(","))})
              VALUES ${Prisma.join(insertValues)}
              ON CONFLICT (${Prisma.raw(identityColumns.join(', '))})
              DO NOTHING
              ${onConflictUpdateWhere ? onConflictUpdateWhere : Prisma.empty};
          `;
        }
    } catch (e) {
        console.log(`Error upserting rows`);
        console.log(items);
        console.log(`into ${table}`);
        console.log(stackTrace);
        throw e;
    }
}

export async function updateMany<T>(
    prisma: PrismaClient,
    table: string,
    identityColumns: string[],
    items: T[],
    columnTypeDict: Record<string, string> = {},
    ignoredKeys: string[] = [],
) {
    if (items.length === 0) return;

    const completeKeys: string[] = Object.keys(items[0] as any);

    const updateFieldsMapper = (item: any) => {
        return Prisma.sql`( ${Prisma.join(
            completeKeys.map((key: string) => item[key] != null ? item[key] : Prisma.sql`NULL::${Prisma.raw(columnTypeDict[key] || 'text')}`)
        )} )`;
    };

    const insertKeys = completeKeys.map((key) =>
        key.toLocaleLowerCase() !== key ? `"${key}"` : `${key}`
    );
    let insertValues = items.map((item) => updateFieldsMapper(item));

    const updateSet = completeKeys.reduce((updateSet: string[], key: string) => {
        if (!identityColumns.includes(key) && !ignoredKeys.includes(key)) {
            updateSet.push(`"${key}" = T."${key}"`);
        }
        return updateSet;
    }, []);

    const whereSet = identityColumns.map(key => `"${table}"."${key}" = T."${key}"`);

    // console.log('items');
    // console.log(insertValues);

    // Capture stack trace here because it gets lost in prisma.$executeRaw
    const stackTrace = new Error().stack;

    try {
        if (updateSet.length > 0) {
            return await prisma.$executeRaw`
              UPDATE ${Prisma.raw(table)} 
              SET ${Prisma.raw(updateSet.join(","))}
              FROM (VALUES ${Prisma.join(insertValues)})
              AS T(${Prisma.raw(insertKeys.join(","))})
              WHERE ${Prisma.raw(whereSet.join(' AND '))}
          `;
        } else {
            throw new Error('updateMany requires at least one column to update');
        }
    } catch (e) {
        console.log(`Error updating rows`);
        console.log(items);
        console.log(`into ${table}`);
        console.log(stackTrace);
        throw e;
    }
}
