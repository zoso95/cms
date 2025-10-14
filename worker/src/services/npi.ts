import { config } from 'dotenv';

// Load environment variables
config();

interface NPIResult {
  number: string;
  basic: {
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    organization_name?: string;
  };
  addresses: Array<{
    address_purpose: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postal_code: string;
    telephone_number?: string;
    fax_number?: string;
  }>;
  taxonomies?: Array<{
    code: string;
    desc: string;
    primary: boolean;
  }>;
}

interface NPISearchParams {
  version?: string;
  number?: string;
  enumeration_type?: string;
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  city?: string;
  state?: string;
  limit?: number;
}

export interface ProviderSearchCriteria {
  firstName?: string;
  lastName?: string;
  organization?: string;
  city?: string;
  state?: string;
}

export interface ProviderContactInfo {
  firstName: string;
  lastName: string;
  organization: string;
  npi: string;
  faxNumber: string;
  address: string;
  city: string;
  state: string;
  specialty?: string;
}

class NPIService {
  private baseUrl: string = 'https://npiregistry.cms.hhs.gov/api/';
  private defaultVersion: string = '2.1';

  // State name to code mapping
  private stateMap: Record<string, string> = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
    'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
    'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
    'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
    'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
    'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
    'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
    'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
    'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
    'district of columbia': 'DC', 'puerto rico': 'PR'
  };

  /**
   * Convert state name to two-letter code
   */
  private normalizeState(state?: string): string | undefined {
    if (!state) return undefined;

    // If already a 2-letter code, return as-is
    if (state.length === 2) return state.toUpperCase();

    // Convert full name to code
    const normalized = this.stateMap[state.toLowerCase()];
    return normalized || state; // Return original if not found
  }

  /**
   * Search for provider with simplified strategy
   */
  async searchProvider(criteria: ProviderSearchCriteria): Promise<{
    success: boolean;
    provider?: ProviderContactInfo;
    candidates?: ProviderContactInfo[];
    error?: string;
  }> {
    console.log('🔍 [NPI] Searching for provider:', criteria);

    // Validate we have at least lastName
    if (!criteria.lastName && !criteria.organization) {
      return {
        success: false,
        error: 'Last name or organization required for NPI lookup'
      };
    }

    try {
      // Strategy 1: Exact match with all available fields
      let results = await this.searchExact(criteria);

      // Strategy 2: If no results and we have organization, try organization search
      if ((!results || results.length === 0) && criteria.organization) {
        console.log('📋 [NPI] Trying organization search');
        results = await this.searchByOrganization(criteria.organization, criteria.state);
      }

      // Strategy 3: Wildcard fallback on names
      if (!results || results.length === 0) {
        console.log('📋 [NPI] Trying wildcard search');
        results = await this.searchWithWildcard(criteria);
      }

      if (!results || results.length === 0) {
        console.log('⚠️ [NPI] No providers found');
        return {
          success: false,
          error: 'No providers found matching criteria'
        };
      }

      console.log(`✅ [NPI] Found ${results.length} provider(s)`);

      // Convert to provider contact info
      const candidates = results.map(r => this.convertToProviderInfo(r));

      // Select best match
      const bestMatch = this.selectBestMatch(results, criteria);
      const provider = bestMatch ? this.convertToProviderInfo(bestMatch) : candidates[0];

      return {
        success: true,
        provider,
        candidates: candidates.slice(0, 5) // Return top 5 candidates
      };

    } catch (error: any) {
      console.error('❌ [NPI] Search failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Search with exact match on all provided fields
   */
  private async searchExact(criteria: ProviderSearchCriteria): Promise<NPIResult[]> {
    const params: NPISearchParams = {
      enumeration_type: 'NPI-1', // Individual providers
      limit: 50
    };

    if (criteria.firstName) params.first_name = criteria.firstName;
    if (criteria.lastName) params.last_name = criteria.lastName;
    if (criteria.city) params.city = criteria.city;
    if (criteria.state) params.state = this.normalizeState(criteria.state);

    console.log('📋 [NPI] Exact search with:', params);
    return await this.performSearch(params);
  }

  /**
   * Search by organization name
   */
  private async searchByOrganization(organization: string, state?: string): Promise<NPIResult[]> {
    const params: NPISearchParams = {
      enumeration_type: 'NPI-2', // Organizations
      organization_name: organization,
      limit: 50
    };

    if (state) params.state = this.normalizeState(state);

    console.log('📋 [NPI] Organization search with:', params);
    return await this.performSearch(params);
  }

  /**
   * Search with wildcard on names
   */
  private async searchWithWildcard(criteria: ProviderSearchCriteria): Promise<NPIResult[]> {
    const params: NPISearchParams = {
      enumeration_type: 'NPI-1',
      limit: 50
    };

    if (criteria.firstName) {
      params.first_name = this.addWildcard(criteria.firstName);
    }
    if (criteria.lastName) {
      params.last_name = this.addWildcard(criteria.lastName);
    }
    if (criteria.state) {
      params.state = this.normalizeState(criteria.state);
    }

    console.log('📋 [NPI] Wildcard search with:', params);
    return await this.performSearch(params);
  }

  /**
   * Perform actual API call to NPI registry
   */
  private async performSearch(params: NPISearchParams): Promise<NPIResult[]> {
    const queryParams = new URLSearchParams();
    queryParams.append('version', params.version || this.defaultVersion);

    Object.entries(params).forEach(([key, value]) => {
      if (value && key !== 'version') {
        queryParams.append(key, value.toString());
      }
    });

    const url = `${this.baseUrl}?${queryParams.toString()}`;
    console.log(`🌐 [NPI] API call: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`NPI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    return data.results || [];
  }

  /**
   * Add wildcard to search term
   */
  private addWildcard(text: string): string {
    if (!text || text.length < 2) return text;
    if (text.includes('*')) return text;

    // Use 75% of the name for wildcard search
    const wildcardLength = Math.max(2, Math.floor(text.length * 0.75));
    return `${text.substring(0, wildcardLength)}*`;
  }

  /**
   * Convert NPI result to ProviderContactInfo
   */
  private convertToProviderInfo(result: NPIResult): ProviderContactInfo {
    const isOrg = !!result.basic.organization_name;
    const primaryAddress = result.addresses.find(a => a.address_purpose === 'LOCATION') || result.addresses[0];
    const taxonomy = result.taxonomies?.find(t => t.primary);

    return {
      firstName: result.basic.first_name || '',
      lastName: result.basic.last_name || '',
      organization: isOrg ? (result.basic.organization_name || '') : (taxonomy?.desc || 'Healthcare Provider'),
      npi: result.number,
      faxNumber: primaryAddress?.fax_number || '',
      address: primaryAddress
        ? `${primaryAddress.address_1}${primaryAddress.address_2 ? ' ' + primaryAddress.address_2 : ''}, ${primaryAddress.city}, ${primaryAddress.state} ${primaryAddress.postal_code}`
        : '',
      city: primaryAddress?.city || '',
      state: primaryAddress?.state || '',
      specialty: taxonomy?.desc
    };
  }

  /**
   * Select best match from results
   */
  private selectBestMatch(results: NPIResult[], criteria: ProviderSearchCriteria): NPIResult | null {
    if (!results || results.length === 0) return null;
    if (results.length === 1) return results[0];

    // Score each result
    const scored = results.map(result => {
      let score = 0;

      const firstName = criteria.firstName?.toLowerCase();
      const lastName = criteria.lastName?.toLowerCase();
      const resultFirst = result.basic.first_name?.toLowerCase();
      const resultLast = result.basic.last_name?.toLowerCase();

      // Exact name matches get highest score
      if (firstName && resultFirst === firstName) score += 3;
      if (lastName && resultLast === lastName) score += 3;

      // Location matches
      const address = result.addresses.find(a => a.address_purpose === 'LOCATION') || result.addresses[0];
      if (address) {
        if (criteria.city && address.city.toLowerCase() === criteria.city.toLowerCase()) score += 2;
        if (criteria.state && address.state.toLowerCase() === criteria.state.toLowerCase()) score += 2;
      }

      // Prefer providers with fax numbers (we need them for records requests)
      if (address?.fax_number) score += 1;

      return { result, score };
    });

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    // Return best match if score is reasonable
    return scored[0].score >= 3 ? scored[0].result : results[0];
  }
}

// Export singleton instance
export const npiService = new NPIService();
