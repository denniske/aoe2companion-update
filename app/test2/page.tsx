import { headers } from 'next/headers'

export default async function Page() {

    const headersData = headers()
    const host = headersData.get('host')
    const protocol = headersData.get('x-forwarded-proto') ?? host?.startsWith('localhost') ? 'http' : 'https'
    const apiBase = `${protocol}://${host}`
    const res = await fetch(`${apiBase}/api/manifest`, {
        next: {
            revalidate: 10 // 10 seconds
        }
    }).then(data => data.json())

    return (
        <div>
            {JSON.stringify(res)}
        </div>
    );
}
