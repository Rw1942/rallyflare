-- Migration number: 0008  2025-10-10
-- Add request/response tracking for structured data collection workflows

-- Requests table: tracks data collection requests (e.g., budget inputs, surveys)
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  
  -- Originating message that started this request
  initial_message_id TEXT UNIQUE,
  
  -- Participants expected to respond
  expected_participants TEXT, -- JSON array of email addresses
  
  -- Status tracking
  status TEXT CHECK(status IN ('active', 'closed', 'cancelled')) DEFAULT 'active',
  deadline TEXT, -- ISO timestamp
  
  -- Metadata
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  created_by_email TEXT
);

-- Responses table: links individual reply emails to requests
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  message_id TEXT NOT NULL UNIQUE, -- Links to messages table
  
  -- Who responded
  responder_email TEXT NOT NULL,
  responder_name TEXT,
  
  -- Extracted structured data (stored as JSON)
  extracted_data TEXT, -- JSON object with parsed fields
  
  -- Status
  is_complete BOOLEAN DEFAULT 1, -- Did they provide all required info?
  certified BOOLEAN DEFAULT 0, -- Did they confirm/certify?
  
  -- Timestamps
  responded_at TEXT NOT NULL DEFAULT (datetime('now')),
  certified_at TEXT,
  
  FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_initial_message ON requests(initial_message_id);
CREATE INDEX IF NOT EXISTS idx_responses_request ON responses(request_id);
CREATE INDEX IF NOT EXISTS idx_responses_message ON responses(message_id);
CREATE INDEX IF NOT EXISTS idx_responses_responder ON responses(responder_email);

