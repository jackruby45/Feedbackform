/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// --- Pre-configured Supabase Credentials ---
const SUPABASE_URL = 'https://zqxxiuejkdxuyimidpdd.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxeHhpdWVqa2R4dXlpbWlkcGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNDkxMzgsImV4cCI6MjA2NjYyNTEzOH0.Vq80Sw7IteQTAE0m5V_GkkEJ7KGWP2VapweLA9PRH6k';

// --- Supabase Client Initialization ---
let supabase: SupabaseClient | null = null;

// --- DOM Element References ---
const appContent = document.getElementById('app-content') as HTMLDivElement;
const fatalErrorContainer = document.getElementById(
  'fatal-error-container',
) as HTMLDivElement;

// Main App Form
const contactForm = document.getElementById('contact-form') as HTMLFormElement;
const firstNameInput = document.getElementById('first-name') as HTMLInputElement;
const lastNameInput = document.getElementById('last-name') as HTMLInputElement;
const phoneInput = document.getElementById('phone') as HTMLInputElement;
const townInput = document.getElementById('town') as HTMLInputElement;
const stateSelect = document.getElementById('state') as HTMLSelectElement;
const zipCodeInput = document.getElementById('zip-code') as HTMLInputElement;
const streetAddressInput = document.getElementById('street-address') as HTMLInputElement;
const unitNumberInput = document.getElementById('unit-number') as HTMLInputElement;
const requestTextarea = document.getElementById('request') as HTMLTextAreaElement;
const saveButton = document.getElementById('save-button') as HTMLButtonElement;
const statusMessage = document.getElementById(
  'status-message',
) as HTMLDivElement;

// --- Functions ---

/**
 * Escapes HTML to prevent XSS.
 * @param {string | undefined} str - The string to escape.
 * @returns {string} The escaped string.
 */
function escapeHtml(str: string | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Displays a critical error message, hiding the main app content.
 * Used for setup problems like a missing table or column.
 * @param {string} title - The title of the error.
 * @param {string} message - The main message body.
 * @param {string} sql - The SQL code to display for the user to copy.
 */
function showFatalError(title: string, message: string, sql: string) {
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : 'https://supabase.com/dashboard';

  appContent.classList.add('hidden');
  fatalErrorContainer.classList.remove('hidden');
  fatalErrorContainer.innerHTML = `
    <div class="fatal-error-content">
        <h3>${title}</h3>
        <p>${message}</p>
        <a href="${sqlEditorUrl}" target="_blank" class="primary-link-button">1. Open Supabase SQL Editor</a>
        <div class="sql-code-block">
            <pre><code>${escapeHtml(sql)}</code></pre>
            <button id="copy-sql-button">2. Copy & Run this SQL</button>
        </div>
        <p>After running the SQL, come back here and click the button below.</p>
        <button id="retry-init-button">3. Retry Connection</button>
    </div>
  `;
  const copyButton = document.getElementById('copy-sql-button') as HTMLButtonElement;
  copyButton.addEventListener('click', () => {
      navigator.clipboard.writeText(sql);
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
          copyButton.textContent = '2. Copy & Run this SQL';
      }, 2000);
  });
  document.getElementById('retry-init-button')?.addEventListener('click', () => {
      fatalErrorContainer.classList.add('hidden');
      appContent.classList.remove('hidden');
      initializeApp();
  });
}

/**
 * Displays a status message to the user (e.g., for success or error).
 * @param {string} message - The message to display.
 * @param {'success' | 'error'} type - The type of message.
 * @param {number} duration - How long to display the message in ms.
 */
function showStatusMessage(
  message: string,
  type: 'success' | 'error',
  duration = 3000,
): void {
  if (!statusMessage) return;
  statusMessage.textContent = message;
  statusMessage.className = type; // 'success' or 'error'

  setTimeout(() => {
    statusMessage.textContent = '';
    statusMessage.className = '';
  }, duration);
}

/**
 * Toggles the loading state of a button.
 * @param {HTMLButtonElement} button - The button element.
 * @param {boolean} isLoading - Whether to show the loading state.
 */
function setButtonLoading(button: HTMLButtonElement, isLoading: boolean): void {
  const text = button.querySelector('.button-text') as HTMLSpanElement;
  const spinnerEl = button.querySelector('.spinner') as HTMLSpanElement;
  if (isLoading) {
    button.disabled = true;
    if (text) text.style.opacity = '0';
    if (spinnerEl) spinnerEl.hidden = false;
  } else {
    button.disabled = false;
    if (text) text.style.opacity = '1';
    if (spinnerEl) spinnerEl.hidden = true;
  }
}

/**
 * Resets the contact form to its initial state.
 */
function resetForm(): void {
  contactForm.reset();
}

/**
 * Handles the contact form submission for creating new contacts.
 * @param {Event} e - The form submission event.
 */
async function handleFormSubmit(e: Event): Promise<void> {
  e.preventDefault();
  if (!supabase) return;

  // Format the address from individual fields
  const unit = unitNumberInput.value ? `, Unit ${unitNumberInput.value}` : '';
  const formattedAddress = `${streetAddressInput.value}${unit}, ${townInput.value}, ${stateSelect.value} ${zipCodeInput.value}`;

  const feedbackData = {
    name: `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`.trim(),
    phone: phoneInput.value,
    address: formattedAddress,
    request: requestTextarea.value,
  };

  setButtonLoading(saveButton, true);

  const { error } = await supabase
    .from('contacts')
    .insert(feedbackData)
    .select()
    .single();

  setButtonLoading(saveButton, false);

  if (error) {
    console.error('Error submitting feedback:', error);
    
    // Specific check for the missing 'request' column
    if (error.code === '42703' && error.message.includes('"request"')) {
      const addColumnSql = `ALTER TABLE public.contacts ADD COLUMN request TEXT;`;
      showFatalError(
        'Database Update Required',
        `The 'request' column is missing from your 'contacts' table. Follow the steps below to add it.`,
        addColumnSql
      );
      return; 
    }
    
    showStatusMessage(`Error: ${error.message}`, 'error', 5000);
  } else {
    showStatusMessage('Feedback submitted successfully!', 'success');
    resetForm();
  }
}

/**
 * Initializes the Supabase client and the application.
 */
async function initializeApp(): Promise<void> {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // A quick check to see if the table exists at all
    const { error } = await supabase.from('contacts').select('id').limit(1);

    // Error '42P01' means the table does not exist.
    if (error && error.code === '42P01') {
      const createTableSql = `CREATE TABLE public.contacts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  name TEXT,
  phone TEXT,
  address TEXT,
  request TEXT
);

-- Enable Row Level Security
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for full public access
CREATE POLICY "Public full access"
ON public.contacts
FOR ALL
USING (true)
WITH CHECK (true);`;

      showFatalError(
        'Setup Required: "contacts" Table Not Found',
        "Connection to Supabase was successful, but the required 'contacts' table is missing. Please create it by following the steps below.",
        createTableSql,
      );
      return;
    }

  } catch (e) {
    const err = e as Error;
    const genericSql = `// No SQL to show, as the connection itself failed.`;
    showFatalError(
        'Failed to connect to Supabase',
        `There was an error initializing the Supabase client. Please check the browser console for more details. Error: ${err.message}`,
        genericSql
    );
  }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', initializeApp);
contactForm.addEventListener('submit', handleFormSubmit);