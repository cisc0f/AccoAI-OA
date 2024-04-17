const API_BASE_URL = 'http://127.0.0.1:5000/api'

export async function get(url: string) {
    const final_url = `${API_BASE_URL}${url}`

    try {
        const response = await fetch(final_url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            mode: 'cors'
        });

        return await response.json();
    } catch (error) {
        console.error(error);
    }
}

export async function deleteRequest(url: string) {
    const final_url = `${API_BASE_URL}${url}`

    try {
        const response = await fetch(final_url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            mode: 'cors'
        });

        return await response.json();
    } catch (error) {
        console.error(error);
    }
}

export async function streamPost(url: string, payload: any, update: (line: string) => void) {
    const final_url = `${API_BASE_URL}${url}`

    try {
        const response = await fetch(final_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            mode: 'cors',   
            body: JSON.stringify(payload)
        });

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder('utf-8');
        let partial = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            partial += decoder.decode(value);
            const lines = partial.split('\n');
            partial = lines.pop() || '';
            for (const line of lines) {
                update(line);
            }
        }

        if (partial) {
            update(partial);
        }
    } catch (error) {
        console.error(error);
    }
}
