# Architecture Design: NVIDIA Nemotron-3-Nano-4B Integration

## Overview

This document outlines the architecture for integrating the NVIDIA Nemotron-3-Nano-4B model into the AI Desktop Assistant via SSH, enabling autonomous agent capabilities.

### Connection Details
- **SSH Server**: `ollimia`
- **SSH Key**: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBNnV/b/0GCSq2Eq6X7zNSqHMfCERYsxJ/Y7Wu/AzzIQ`
- **Model**: `nvidia/nemotron-3-nano-4b`

---

## 1. System Architecture Overview

```mermaid
flowchart TB
    subgraph Client["Electron Desktop App"]
        UI["User Interface<br/>index.html"]
        AgentCore["Agent Core<br/>agent-core.js"]
    end
    
    subgraph AI_Layer["AI Abstraction Layer"]
        LLMAdapter["LLM Adapter<br/>llm-adapter.js"]
        ProviderRouter["Provider Router"]
    end
    
    subgraph Providers["AI Providers"]
        OpenAI["OpenAI Provider<br/>(legacy)"]
        Nemotron["NVIDIA Nemotron Provider<br/>(new)"]
    end
    
    subgraph SSH_Connection["SSH Connection Layer"]
        SSHManager["SSH Manager<br/>ssh-manager.js"]
        SSH_Tunnel["SSH Tunnel<br/>Connection Pool"]
    end
    
    subgraph Remote["Remote GPU Server<br/>ollimia"]
        ModelServer["Nemotron-3-Nano-4B<br/>Model Server"]
        API["NVIDIA API<br/>Endpoints"]
    end
    
    subgraph Skills["Skills System"]
        TP["TextProcessor"]
        FO["FileOrganizer"]
        AA["AppAutomator"]
        WA["WebAutomator"]
    end
    
    UI --> AgentCore
    AgentCore --> LLMAdapter
    LLMAdapter --> ProviderRouter
    ProviderRouter --> OpenAI
    ProviderRouter --> Nemotron
    Nemotron --> SSHManager
    SSHManager --> SSH_Tunnel
    SSH_Tunnel --> Remote
    AgentCore --> Skills
    Skills --> TP & FO & AA & WA
```

---

## 2. SSH Connection Management

### 2.1 SSH Manager Module

The SSH connection will be managed through a dedicated module that handles connection pooling, reconnection, and lifecycle management.

```mermaid
flowchart LR
    subgraph Pool["Connection Pool"]
        C1["Connection 1"]
        C2["Connection 2"]
        C3["Connection N"]
    end
    
    subgraph Manager["SSH Manager"]
        Init["Initialize"]
        Acquire["Acquire Connection"]
        Release["Release Connection"]
        KeepAlive["Keep-Alive"]
        Reconnect["Reconnect Logic"]
    end
    
    Init --> Pool
    Acquire --> C1
    Release --> Pool
    KeepAlive --> Pool
    Reconnect --> Pool
```

### 2.2 Configuration

Add to `.env`:
```
# SSH Configuration
SSH_HOST=ollimia
SSH_PORT=22
SSH_USER=<username>
SSH_KEY_PATH=~/.ssh/id_ed25519

# Alternative: Inline key (for testing)
# SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----\n...

# Model Configuration
NVIDIA_MODEL=nvidia/nemotron-3-nano-4b
NVIDIA_API_BASE=http://localhost:8000/v1
```

### 2.3 Connection Features

| Feature | Description |
|---------|-------------|
| **Connection Pool** | Maintain 2-3 persistent SSH connections for parallel requests |
| **Auto-Reconnect** | Automatically reconnect on connection drop |
| **Keep-Alive** | Send periodic keep-alive packets to prevent timeout |
| **Connection Timeout** | 30-second timeout for all operations |
| **Retry Logic** | 3 retries with exponential backoff on failure |

---

## 3. NVIDIA API Adapter Layer

### 3.1 LLM Adapter Architecture

```mermaid
classDiagram
    class LLMAdapter {
        +registerProvider(provider)
        +generate(prompt, options)
        +chat(messages, options)
        +getProvider()
    }
    
    class Provider {
        <<interface>>
        +generate(prompt) Promise~string~
        +chat(messages) Promise~ChatResponse~
    }
    
    class OpenAIProvider {
        +generate(prompt)
        +chat(messages)
    }
    
    class NemotronProvider {
        +generate(prompt)
        +chat(messages)
        -sshConnection
        -modelConfig
    }
    
    LLMAdapter --> Provider
    Provider <|.. OpenAIProvider
    Provider <|.. NemotronProvider
```

### 3.2 Provider Interface

```javascript
// Interface that all AI providers must implement
class BaseProvider {
    async generate(prompt, options = {}) {
        // options: { temperature, max_tokens, stream }
        throw new Error('Not implemented');
    }
    
    async chat(messages, options = {}) {
        // messages: [{ role: 'user' | 'assistant' | 'system', content: string }]
        throw new Error('Not implemented');
    }
}
```

### 3.3 Nemotron Provider Implementation

The NVIDIA provider will use SSH to communicate with the remote model server:

```javascript
class NemotronProvider extends BaseProvider {
    constructor(config = {}) {
        super();
        this.sshManager = config.sshManager;
        this.model = config.model || 'nvidia/nemotron-3-nano-4b';
        this.baseUrl = config.apiBase || 'http://localhost:8000/v1';
    }
    
    async chat(messages, options = {}) {
        // Send request via SSH tunnel to remote model server
        const payload = {
            model: this.model,
            messages: messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2048,
            stream: options.stream || false
        };
        
        // Execute via SSH and parse response
        return await this.sshManager.executeCommand(
            `curl -X POST "${this.baseUrl}/chat/completions" ` +
            `-H "Content-Type: application/json" ` +
            `-d '${JSON.stringify(payload)}'`
        );
    }
}
```

---

## 4. Agent Loop Design

### 4.1 Autonomous Agent Architecture

```mermaid
flowchart TB
    subgraph Perceive["PERCEIVE"]
        Input["User Input<br/>Voice/Text"]
        Context["Collect Context<br/>System State"]
        Parse["Parse Intent"]
    end
    
    subgraph Think["THINK"]
        Plan["Generate Plan"]
        Reason["Reason about<br/>Actions"]
        Decide["Decide Next<br/>Action"]
    end
    
    subgraph Act["ACT"]
        Execute["Execute Action"]
        Verify["Verify Result"]
        Learn["Learn from<br/>Feedback"]
    end
    
    Perceive --> Think
    Think --> Act
    Act -->|feedback| Perceive
```

### 4.2 Agent Loop States

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Perceiving: User Input
    Perceiving --> Thinking: Input Parsed
    Thinking --> Planning: Intent Determined
    Planning --> Executing: Plan Ready
    Executing --> Verifying: Action Complete
    Verifying --> Idle: Success
    Verifying --> Planning: Retry Needed
    Verifying --> Perceiving: Complex Task
```

### 4.3 Core Agent Implementation

```javascript
class AgentCore {
    constructor(options = {}) {
        this.llmAdapter = options.llmAdapter;
        this.skills = options.skills;
        this.maxIterations = options.maxIterations || 10;
        this.confirmationRequired = options.confirmationRequired || true;
    }
    
    async run(userInput, context = {}) {
        let iteration = 0;
        let state = 'perceiving';
        
        while (iteration < this.maxIterations) {
            switch (state) {
                case 'perceiving':
                    state = await this.perceive(userInput, context);
                    break;
                case 'thinking':
                    state = await this.think(context);
                    break;
                case 'planning':
                    state = await this.plan(context);
                    break;
                case 'executing':
                    state = await this.execute(context);
                    break;
                case 'verifying':
                    state = await this.verify(context);
                    break;
                case 'idle':
                    return context.result;
            }
            iteration++;
        }
        
        return { success: false, error: 'Max iterations reached' };
    }
    
    async perceive(input, context) {
        // Collect system state
        context.systemState = await this.collectSystemState();
        
        // Use LLM to parse intent
        const prompt = `
            Analyze this user request and extract:
            1. Intent (what they want to accomplish)
            2. Entities (files, apps, data involved)
            3. Constraints (limitations or requirements)
            
            User request: "${input}"
            
            Return JSON with: intent, entities, constraints
        `;
        
        context.parsed = await this.llmAdapter.generate(prompt);
        return 'thinking';
    }
    
    async think(context) {
        // Reason about the best approach
        const prompt = `
            Given the parsed intent: ${context.parsed.intent}
            And available skills: ${Object.keys(this.skills).join(', ')}
            
            Determine which skill(s) to use and the approach.
            Return JSON with: skillName, approach, expectedOutcome
        `;
        
        context.plan = await this.llmAdapter.generate(prompt);
        return 'planning';
    }
    
    async plan(context) {
        // If dangerous operation, request confirmation
        if (this.confirmationRequired && this.isDangerousOperation(context.plan)) {
            context.needsConfirmation = true;
            return 'idle'; // Return to UI for confirmation
        }
        
        // Generate execution steps
        context.steps = this.generateSteps(context.plan);
        return 'executing';
    }
    
    async execute(context) {
        const currentStep = context.steps[context.currentStepIndex];
        
        // Execute the skill
        const skill = this.skills[currentStep.skillName];
        const result = await skill[currentStep.method](...currentStep.args);
        
        context.executionHistory.push({
            step: currentStep,
            result: result
        });
        
        context.currentStepIndex++;
        
        return 'verifying';
    }
    
    async verify(context) {
        // Check if all steps completed
        if (context.currentStepIndex >= context.steps.length) {
            context.result = {
                success: true,
                summary: this.generateSummary(context.executionHistory)
            };
            return 'idle';
        }
        
        // Check if current step needs retry
        const lastResult = context.executionHistory[context.executionHistory.length - 1];
        if (!lastResult.result.success) {
            return 'planning'; // Retry with new plan
        }
        
        return 'executing';
    }
}
```

---

## 5. Integration with Existing Skills

### 5.1 Skill Integration Pattern

```mermaid
flowchart LR
    subgraph Before["Current (OpenAI)"]
        TP1["TextProcessor"]
        OpenAI["OpenAI API"]
    end
    
    subgraph After["With Nemotron"]
        TP2["TextProcessor"]
        LLM["LLM Adapter"]
        Nemotron["Nemotron Provider"]
    end
    
    TP1 --> OpenAI
    TP2 --> LLM --> Nemotron
```

### 5.2 Text Processor Integration

Modify `src/skills/text-processor.js`:

```javascript
// Before
const OpenAI = require('openai');

class TextProcessor {
    constructor(openaiApiKey = null) {
        const apiKey = openaiApiKey || process.env.OPENAI_API_KEY;
        this.openai = apiKey ? new OpenAI({ apiKey }) : null;
    }
}

// After
const LLMAdapter = require('../ai/llm-adapter');

class TextProcessor {
    constructor(llmAdapter = null) {
        this.llm = llmAdapter || global.llmAdapter;
    }
    
    async summarizeText(text, options = {}) {
        if (this.llm) {
            const prompt = `Summarize the following text in a ${options.style || 'concise'} style, keeping it under ${options.maxLength || 100} words:\n\n${text}`;
            const result = await this.llm.generate(prompt, { maxTokens: 200 });
            return { success: true, result, method: 'ai' };
        }
        // Fallback logic...
    }
}
```

### 5.3 All Skills to Update

| Skill File | Integration Point |
|------------|-------------------|
| `text-processor.js` | `summarizeText`, `translateText`, `rewriteText` |
| `file-organizer.js` | `generateNewName` (AI-powered naming) |
| `web-automator.js` | Content summarization |
| `app-automator.js` | Intelligent app recommendations |

---

## 6. File Structure Changes

### 6.1 New Directory Structure

```
src/
├── main.js                 # Entry point (unchanged)
├── skills/
│   ├── index.js
│   ├── text-processor.js   # Update: use LLM adapter
│   ├── file-organizer.js
│   ├── app-automator.js
│   └── web-automator.js
├── modules/
│   ├── voice-controller.js
│   ├── task-scheduler.js
│   ├── package-manager.js
│   ├── email-handler.js
│   ├── data-analyzer.js
│   └── index.js
├── ai/                     # NEW: AI integration layer
│   ├── index.js
│   ├── llm-adapter.js      # NEW: Unified LLM interface
│   ├── providers/          # NEW: Provider implementations
│   │   ├── index.js
│   │   ├── base-provider.js
│   │   ├── openai-provider.js
│   │   └── nemotron-provider.js
│   └── agent-core.js       # NEW: Autonomous agent loop
├── ssh/                    # NEW: SSH connection layer
│   ├── index.js
│   ├── ssh-manager.js      # NEW: SSH connection pool
│   └── ssh-connection.js   # NEW: Individual connection
└── config/
    └── providers.js         # NEW: Provider configuration
```

### 6.2 New Files to Create

| File | Purpose |
|------|----------|
| `src/ai/llm-adapter.js` | Unified interface for all AI providers |
| `src/ai/providers/base-provider.js` | Abstract base class |
| `src/ai/providers/nemotron-provider.js` | NVIDIA Nemotron implementation |
| `src/ai/providers/openai-provider.js` | OpenAI implementation (legacy support) |
| `src/ai/agent-core.js` | Autonomous agent loop |
| `src/ssh/ssh-manager.js` | Connection pooling and management |
| `src/ssh/ssh-connection.js` | SSH connection wrapper |

### 6.3 Dependencies to Add

```json
{
  "dependencies": {
    "ssh2": "^1.15.0",
    "ssh2-pool": "^0.8.0",
    "xml2js": "^0.5.0"
  }
}
```

---

## 7. Implementation Checklist

- [ ] **SSH Layer**
  - [ ] Create `src/ssh/ssh-manager.js` with connection pooling
  - [ ] Implement keep-alive and reconnection logic
  - [ ] Add SSH key authentication support

- [ ] **AI Provider Layer**
  - [ ] Create `src/ai/llm-adapter.js` with provider routing
  - [ ] Implement `src/ai/providers/nemotron-provider.js`
  - [ ] Implement `src/ai/providers/openai-provider.js` for backward compatibility
  - [ ] Add configuration for provider selection

- [ ] **Agent Core**
  - [ ] Implement `src/ai/agent-core.js` with perceive-think-act loop
  - [ ] Add skill registration system
  - [ ] Implement confirmation workflow for dangerous operations

- [ ] **Skills Integration**
  - [ ] Update `text-processor.js` to use LLM adapter
  - [ ] Update `file-organizer.js` for AI-powered features
  - [ ] Update other skills as needed

- [ ] **Configuration**
  - [ ] Update `.env` with SSH and NVIDIA settings
  - [ ] Create `src/config/providers.js` for configuration

- [ ] **Testing**
  - [ ] Test SSH connection to ollimia
  - [ ] Test model inference via SSH
  - [ ] Test agent loop with sample tasks
  - [ ] Test backward compatibility with OpenAI

---

## 8. Security Considerations

| Aspect | Implementation |
|--------|-----------------|
| **SSH Key Storage** | Store in `~/.ssh/` directory, not in code |
| **Connection Security** | Use key-based authentication only |
| **Input Validation** | Sanitize all user inputs before LLM processing |
| **Rate Limiting** | Implement per-user rate limits |
| **Logging** | Log all agent actions for audit |
| **Confirmation** | Require user confirmation for destructive operations |

---

## 9. Migration Path

1. **Phase 1**: Implement SSH layer and NVIDIA provider (without agent)
2. **Phase 2**: Integrate provider into TextProcessor
3. **Phase 3**: Implement Agent Core with basic loop
4. **Phase 4**: Add autonomous capabilities progressively
5. **Phase 5**: Full testing and optimization

---

*Document Version: 1.0*
*Last Updated: 2026-03-25*
