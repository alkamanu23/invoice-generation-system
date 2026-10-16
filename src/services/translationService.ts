import { TranslationServiceClient } from '@google-cloud/translate';

const client = new TranslationServiceClient();

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';

export async function translateText(text: string, targetLanguage: string) {
    if (!text || text.trim() === '') return text; 

    const request = {
        parent: `projects/${projectId}/locations/${location}`,
        contents: [text], //array so you can translate multiple things in one call
        mimeType: 'text/plain',
        targetLanguageCode: targetLanguage,
    };
    const [response] = await client.translateText(request);
    return response.translations?.[0]?.translatedText ?? '';
}