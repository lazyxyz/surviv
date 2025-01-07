const spamApi = async (url: string, interval: number, maxRequests: number): Promise<void> => {
    let requestCount = 0;

    const sendRequest = async (): Promise<void> => {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(`Request #${requestCount + 1}:`, data);
        } catch (error) {
            console.error(`Request #${requestCount + 1} failed:`, (error as Error).message);
        } finally {
            requestCount++;
            if (requestCount < maxRequests) {
                setTimeout(sendRequest, interval);
            } else {
                console.log('Finished spamming the API!');
            }
        }
    };

    sendRequest();
};

// Configuration
const apiUrl: string = 'http://localhost:8000/api/getGame?teamSize=1'; // API endpoint
const intervalMs: number = 500; // Time between requests in milliseconds
const maxRequests: number = 100; // Total number of requests

spamApi(apiUrl, intervalMs, maxRequests);
