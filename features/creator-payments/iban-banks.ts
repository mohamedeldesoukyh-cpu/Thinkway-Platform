/**
 * Public bank metadata only; never learn routing from another creator's account.
 * UAE code/BIC directory: HSBC, List of Beneficiary Bank Codes, March 2022:
 * https://www.business.hsbc.ae/-/media/library/markets-selective/uae/pdf/list-of-beneficiary-bank-codes-for-autopay-services.pdf
 * Reviewed 2026-09-21. Excludes exchange houses, placeholder BICs and legacy
 * merged-bank entries whose current routing cannot be established from this list.
 * Add verified country/code entries here, without changing the parser or form.
 * A directory match is not confirmation of account ownership or bank acceptance.
 */
export const IBAN_BANKS: Readonly<Record<string, Readonly<Record<string, readonly [name: string, swift: string]>>>> = {
    AE: {
        '003': ['Abu Dhabi Commercial Bank', 'ADCBAEAA'],
        '004': ['Al Ahli Bank of Kuwait', 'ABKKAEAD'],
        '005': ['Rafidain Bank', 'RAFBAEAD'],
        '007': ['Arab African International Bank', 'ARAIAEAD'],
        '008': ['Al Masraf', 'ABINAEAA'],
        '009': ['Arab Bank', 'ARABAEAD'],
        '011': ['Bank of Baroda', 'BARBAEAD'],
        '012': ['Bank of Sharjah', 'SHARAEAS'],
        '014': ['Blom Bank France', 'BLOMAEAD'],
        '015': ['Banque Misr', 'BMISAEAA'],
        '016': ['Credit Agricole Corporate and Investment Bank', 'BSUIAEAD'],
        '018': ['BNP Paribas', 'BNPAAEAA'],
        '019': ['Barclays Bank', 'BARCAEAD'],
        '020': ['HSBC Bank Middle East', 'BBMEAEAD'],
        '021': ['Citibank NA', 'CITIAEAD'],
        '022': ['Commercial Bank International', 'CLBIAEAD'],
        '023': ['Commercial Bank of Dubai', 'CBDUAEAD'],
        '024': ['Dubai Islamic Bank', 'DUIBAEAD'],
        '025': ['El Nilein Bank', 'NILBAEAA'],
        '026': ['Emirates NBD Bank PJSC', 'EBILAEAD'],
        '028': ['Habib Bank Limited', 'HABBAEAD'],
        '029': ['Habib Bank AG Zurich', 'HBZUAEAD'],
        '030': ['Investbank', 'IBTFAEAS'],
        '031': ['Janata Bank', 'JANBAEAA'],
        '033': ['Mashreq Bank', 'BOMLAEAD'],
        // Also confirmed by https://www.emiratesislamic.ae/en/help-and-support/your-iban-and-swift
        '034': ['Emirates Islamic Bank PJSC', 'MEBLAEAD'],
        // Current name/BIC and code 035 corroborated by RBI's 2026 settlement instructions:
        // https://www.rbinternational.com/content/dam/rbi/ho/corporates/our-solutions/cash-management/RBI_Productsheet_CommercialPayments-SSI_MainCorrespondents_EN.pdf.coredownload.pdf
        '035': ['First Abu Dhabi Bank PJSC', 'NBADAEAA'],
        '036': ['National Bank of Bahrain', 'NBOBAEAA'],
        '038': ['National Bank of Fujairah', 'NBFUAEAF'],
        '039': ['National Bank of Oman', 'NBOMAEAD'],
        '040': ['National Bank of Ras Al-Khaimah (RAKBANK)', 'NRAKAEAK'],
        '041': ['Sharjah Islamic Bank', 'NBSHAEAS'],
        '042': ['National Bank of Umm Al Qaiwain', 'UMMQAEAD'],
        '043': ['Industrial and Commercial Bank of China', 'ICBKAEAA'],
        '044': ['Standard Chartered Bank', 'SCBLAEAD'],
        '046': ['United Arab Bank', 'UARBAEAA'],
        '047': ['United Bank Limited', 'UNILAEAD'],
        '049': ['Deutsche Bank', 'DEUTAEAA'],
        '050': ['Abu Dhabi Islamic Bank', 'ABDIAEAD'],
        '053': ['Al Hilal Bank', 'HLALAEAA'],
        '054': ['Doha Bank', 'DOHBAEAD'],
        '056': ['National Bank of Kuwait', 'NBOKAEAD'],
        '057': ['Ajman Bank', 'AJMNAEAJ'],
        // Existing verified mapping, newer than the HSBC directory:
        // https://convera.com/en-gb/resources/iban-codes/united-arab-emirates/ae560860000009192749396/
        // https://ibanapi.com/bank/43434/wio-bank-p.j.s.c.
        '086': ['Wio Bank PJSC', 'WIOBAEAD'],
        '092': ['Gulf International Bank', 'GULFAEAA'],
        '093': ['Intesa Sanpaolo', 'BCITAEAB'],
    },
};
