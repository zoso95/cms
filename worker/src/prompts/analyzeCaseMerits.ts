export function getAnalyzeCaseMeritsPrompt(transcript: string, existingVariables: any): string {
  return `
Please analyze this medical malpractice intake call transcript and provide a comprehensive case evaluation.

TRANSCRIPT:
${transcript}

EXISTING EXTRACTED DATA:
${JSON.stringify(existingVariables, null, 2)}

SCORING RUBRIC - Use these grounding references for consistent scoring:

Economic Harm (0-10):
0-2: Minimal economic impact (minor medical bills under $5k, no ongoing treatment, no lost income)
3-4: Low economic impact ($5k-$25k in bills, short recovery period, minimal lost wages)
5-6: Moderate economic impact ($25k-$100k in bills, ongoing treatment needed, some lost income)
7-8: Significant economic impact ($100k-$500k, permanent care needs, substantial lost income)
9-10: Severe economic impact ($500k+, lifetime care required, complete inability to work)

Pain and Suffering (0-10):
0-2: Minimal pain/suffering (temporary discomfort, no lasting impact)
3-4: Mild pain/suffering (manageable chronic pain, minor psychological impact)
5-6: Moderate pain/suffering (significant chronic pain, moderate quality of life impact)
7-8: Severe pain/suffering (debilitating pain, major loss of function, PTSD)
9-10: Extreme pain/suffering (permanent disability, disfigurement, severe psychological trauma)

Causation Strength (0-10):
0-2: Weak causation (many alternative causes, unclear link to medical error)
3-4: Questionable causation (some alternative explanations, preexisting conditions complicate)
5-6: Moderate causation (likely related to medical error, but not certain)
7-8: Strong causation (clear link between error and harm, minimal alternative explanations)
9-10: Direct causation (undeniable connection, error directly caused specific harm)

Standard of Care Deviation (0-10):
0-2: No clear deviation (treatment within accepted guidelines, judgment call)
3-4: Questionable deviation (debatable whether standard was met)
5-6: Moderate deviation (some clear lapses, but not egregious)
7-8: Significant deviation (obvious departure from standard care)
9-10: Gross negligence (flagrant violation of basic medical standards)

You must respond with ONLY a valid JSON object (no other text before or after). Use the following exact format:

{
  "summary": "<brief summary of the call and potential case>",
  "medicalSubject": "<the major medical conditions present that are the cause of the dispute (e.g., 'Birth injury resulting in cerebral palsy', 'Misdiagnosed cancer leading to metastasis', 'Surgical error causing nerve damage')>",
  "patientInfo": {
    "firstName": "<if mentioned>",
    "lastName": "<if mentioned>",
    "dateOfBirth": "<if mentioned>",
    "age": "<estimate if possible>",
    "phoneNumber": "<if mentioned>",
    "email": "<if mentioned>",
    "address": "<if mentioned>",
    "insuranceInfo": "<if mentioned>",
    "medicalRecordNumber": "<if mentioned>",
    "relationshipToPatient": "<if caller is not the patient>",
    "dependents": "<any children/dependents mentioned>",
    "employment": "<job/work status if mentioned>",
    "overallHealthBaseline": "<was patient otherwise healthy?>"
  },
  "doctorInfoQuality": {
    "score": 1-10,
    "hasName": boolean,
    "hasFaxNumber": boolean,
    "hasAddress": boolean,
    "hasNPI": boolean,
    "completeness": "<assessment of doctor info quality>",
    "providerType": "<GP, specialist, hospital, etc>",
    "providerQualifications": "<any info about provider background>"
  },
  "coreScales": {
    "economicHarm": {
      "score": 0-10,
      "reasoning": "<detailed explanation for score>",
      "estimates": {
        "medicalBillsToDate": "<amount if mentioned>",
        "projectedFutureCare": "<estimate if discussed>",
        "lostIncome": "<amount and duration if mentioned>",
        "lifetimeCareNeeded": boolean
      }
    },
    "painAndSuffering": {
      "score": 0-10,
      "reasoning": "<detailed explanation for score>",
      "factors": {
        "ongoingPain": "<chronic pain mentioned?>",
        "psychologicalImpact": "<PTSD, trauma, etc>",
        "qualityOfLifeLoss": "<functional limitations>",
        "disfigurement": "<visible scarring, deformity>",
        "permanentDisability": "<permanent impairments>"
      }
    },
    "causationStrength": {
      "score": 0-10,
      "reasoning": "<how clearly harm stems from medical error>",
      "factors": {
        "directLink": "<obvious connection to medical error>",
        "preexistingConditions": "<complicating factors>",
        "alternativeOutcome": "<would correct treatment have helped?>"
      }
    },
    "standardOfCareDeviation": {
      "score": 0-10,
      "reasoning": "<assessment of medical negligence>",
      "factors": {
        "grossNegligence": "<obvious malpractice indicators>",
        "judgmentCall": "<gray area decisions>",
        "withinGuidelines": "<followed standard protocols>"
      }
    }
  },
  "caseFactors": {
    "severityOfOutcome": {
      "death": boolean,
      "birthInjury": boolean,
      "permanentDisability": boolean,
      "lossOfMobility": boolean,
      "organDysfunction": boolean,
      "sexualReproductiveHarm": boolean,
      "disfigurementAmputation": boolean,
      "description": "<detailed description of injuries/outcomes>"
    },
    "medicalContext": {
      "diseaseArea": "<cancer, heart, orthopedic, OB-GYN, etc>",
      "highRiskProcedure": boolean,
      "routineCare": boolean,
      "preexistingConditions": ["<list conditions that complicate causation>"],
      "procedureType": "<what treatment/procedure was involved>"
    },
    "errorType": {
      "category": "<misdiagnosis|wrong-site-surgery|medication-error|surgical-error|anesthesia-error|communication-error|false-positive|lack-of-consent>",
      "description": "<detailed description of the alleged error>",
      "timeliness": "<was error recognized/corrected promptly?>",
      "multipleErrors": boolean,
      "concealment": "<any attempts to hide the error?>"
    },
    "providerSystemFactors": {
      "appropriateProvider": "<was provider qualified for this care?>",
      "supervisionIssues": "<understaffing, lack of supervision>",
      "systemicProblems": "<hospital/clinic system issues>",
      "informedConsent": "<did patient understand risks?>"
    }
  },
  "legalPracticalFactors": {
    "timelineFromError": "<how long ago did the error occur?>",
    "statuteOfLimitations": "<any timing concerns?>",
    "evidenceAvailability": "<medical records, witnesses, etc>",
    "patientCredibility": "<how credible is the patient's account?>",
    "providerResponse": "<has provider acknowledged any issues?>"
  },
  "callQualityAssessment": {
    "patientWillingness": "<cooperative|hesitant|resistant>",
    "informationCompleteness": 1-10,
    "callClarity": 1-10,
    "followUpNeeded": boolean,
    "concernsRaised": ["<list any concerns mentioned>"],
    "emotionalState": "<patient's emotional condition>",
    "consistency": "<story consistent throughout call?>"
  },
  "nextActions": {
    "recommendedNextStep": "<what should happen next>",
    "urgencyLevel": "<low|medium|high>",
    "caseViability": "<strong|moderate|weak|insufficient-info>",
    "additionalInfoNeeded": ["<list missing critical information>"],
    "specialInstructions": "<any special handling needed>",
    "recordsPriority": "<which records are most critical to obtain first>",
    "expertNeed": "<what type of medical expert might be needed?>"
  },
  "complianceNotes": {
    "consentGiven": boolean,
    "patientVerified": boolean,
    "hipaaConcerns": ["<any HIPAA-related issues>"],
    "legalConcerns": ["<any legal issues>"],
    "ethicalConsiderations": ["<any ethical concerns>"]
  },
  "overallCaseAssessment": {
    "estimatedCaseValue": "<rough estimate if enough info: minimal|low|moderate|high|very-high>",
    "keyStrengths": ["<list main case strengths>"],
    "keyWeaknesses": ["<list main case weaknesses>"],
    "criticalFactors": ["<what factors will make or break this case?>"],
    "investigationPriorities": ["<what needs to be investigated first?>"]
  }
}

IMPORTANT:
1. Respond with ONLY raw valid JSON - no explanatory text before or after
2. DO NOT wrap the JSON in markdown code blocks (no \`\`\`json or \`\`\`)
3. Start your response with { and end with }
4. For each score, provide detailed reasoning in the reasoning fields
5. If information is missing, note that explicitly in the relevant fields
6. Extract every piece of relevant information from the transcript
7. Focus on building a comprehensive case evaluation for legal viability

Ensure the JSON is properly formatted and complete.`;
}
