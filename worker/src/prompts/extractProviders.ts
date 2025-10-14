export function getExtractProvidersPrompt(transcript: string): string {
  return `
Analyze this medical transcript and extract ALL healthcare providers mentioned. For each provider, extract as much information as possible.

TRANSCRIPT:
${transcript}

Return a JSON array of providers with the following structure for each provider:

[
  {
    "firstName": "<first name if mentioned, otherwise null>",
    "lastName": "<last name if mentioned, otherwise null>",
    "fullName": "<full name as mentioned in transcript>",
    "specialty": "<medical specialty if mentioned (e.g., 'cardiologist', 'OB-GYN', 'general surgeon')>",
    "providerType": "<doctor|nurse|hospital|clinic|healthcare-system>",
    "organization": "<hospital or healthcare system name if mentioned>",
    "city": "<city if mentioned>",
    "state": "<state if mentioned>",
    "address": "<full address if mentioned>",
    "phoneNumber": "<phone number if mentioned>",
    "faxNumber": "<fax number if mentioned>",
    "npi": "<NPI number if mentioned>",
    "role": "<their role in the case: primary-care|specialist|surgeon|treating-physician|consulting|emergency>",
    "contextInCase": "<brief description of their involvement in this case>"
  }
]

IMPORTANT:
1. Return ONLY raw valid JSON array - no explanatory text before or after
2. DO NOT wrap the JSON in markdown code blocks (no \`\`\`json or \`\`\`)
3. Start your response with [ and end with ]
4. Include ALL providers mentioned, even if information is incomplete
5. If a field is not mentioned, use null (not empty string)
6. Be thorough - extract every provider reference
7. If the same provider is mentioned multiple times, consolidate into one entry
8. If only a last name is given (e.g., "Dr. Smith"), use null for firstName
9. CRITICAL: Do NOT create separate entries for hospitals/clinics when they are mentioned as the location where a doctor works. Instead, put the hospital/clinic name in the "organization" field of the doctor's entry. Only create a separate hospital/clinic entry if records need to be requested from that facility directly without a specific doctor being named.

Example output:
[
  {
    "firstName": "John",
    "lastName": "Smith",
    "fullName": "Dr. John Smith",
    "specialty": "cardiologist",
    "providerType": "doctor",
    "organization": "Memorial Hospital",
    "city": "Boston",
    "state": "MA",
    "address": "123 Main St, Boston, MA 02101",
    "phoneNumber": "617-555-1234",
    "faxNumber": "617-555-1235",
    "npi": null,
    "role": "primary-care",
    "contextInCase": "Primary treating physician who failed to diagnose heart condition"
  }
]`;
}
