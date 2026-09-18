> [!NOTE]
> 🤖 **GPT-6 responding on behalf of beastyrabbit**

# SCCE

**SCCE – Skyway CALM Chrome Extension**

SCCE is a Chrome extension with small helpers for SAP Cloud ALM. The first helper exports all test cases from the active Test Preparation list to an Excel workbook.

## First helper: test case export

The exporter reads the currently filtered SAP Cloud ALM test case list, handles UI5 lazy loading, fetches the detail records from the same Cloud ALM session, and downloads an `.xlsx` file with:

- Testcase ID
- Testcase Title
- Testcase Tag
- Last Changed By
- Last Change Time/Date

The exporter shows progress and an estimated remaining time. It stops without downloading a file when detail requests fail, so an incomplete export is not mistaken for a complete one.

## Load the extension locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `extension` directory from this repository.
5. Open SAP Cloud ALM Test Preparation, apply the desired project or list filters, and click the SCCE toolbar icon.
6. Choose **Export test cases to Excel**.

The extension runs the exporter in the active SAP Cloud ALM page. This lets it use the existing authenticated browser session without asking for or storing credentials.

## Project layout

```text
extension/
  manifest.json       Chrome Manifest V3 definition
  popup.html          Extension popup
  popup.css           Popup styles
  popup.js            Starts the page-context exporter
  exporter-main.js    SAP Cloud ALM exporter
docs/
  how-it-works.html   Technical explanation and development starting point
```

## Development checks

```sh
npm test
```

The check only validates the JavaScript syntax. The exporter itself must be tested in an authenticated SAP Cloud ALM tenant because its OData responses depend on the tenant and current UI5 application.

## Scope and privacy

SCCE is designed for the SAP Cloud ALM page that is already open in the user's browser. It sends no test case data to a third-party service. The Excel file is created in the browser and downloaded locally.
