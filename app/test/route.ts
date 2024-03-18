import {headers} from "next/headers";

// export const revalidate = 5;
// const apiBase = 'http://localhost:3000'

export async function GET(request: Request, context: any) {
    const headersData = headers()
    console.log(headersData);
    const host = headersData.get('host')
    const protocol = headersData.get('x-forwarded-proto') ?? host?.startsWith('localhost') ? 'http' : 'https'
    const apiBase = `${protocol}://${host}`
    console.log('apiBase', apiBase);

    return await fetch(`${apiBase}/api/manifest`, {
        next: {
            revalidate: 10 // 10 seconds
        },
        headers: headersData,
    });
}
