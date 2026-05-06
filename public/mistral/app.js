const generateBtn = document.getElementById('generate-btn');
const loader = document.getElementById('loader');
const btnText = generateBtn.querySelector('.btn-text');
const resultsArea = document.getElementById('results-area');
const titleText = document.getElementById('title-text');
const keywordsText = document.getElementById('keywords-text');
const rawResponse = document.getElementById('raw-response');

generateBtn.addEventListener('click', async () => {
    const prompt = document.getElementById('image-desc').value;
    const model = document.getElementById('model-select').value;
    const apiKey = document.getElementById('api-key').value;

    if (!prompt) {
        alert('Please enter a description!');
        return;
    }

    if (!apiKey) {
        alert('Please enter your Mistral API Key!');
        return;
    }

    // Reset UI
    setLoading(true);
    resultsArea.style.display = 'none';

    try {
        const response = await fetch('/api/mistral', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey,
                model,
                prompt
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || data.error || 'Failed to generate metadata');
        }

        const content = data.choices[0].message.content;
        parseAndDisplay(content);
        rawResponse.textContent = JSON.stringify(data, null, 2);
        resultsArea.style.display = 'block';
        
        // Smooth scroll to results
        resultsArea.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        console.error(error);
        alert('Error: ' + error.message);
    } finally {
        setLoading(false);
    }
});

function setLoading(isLoading) {
    if (isLoading) {
        generateBtn.disabled = true;
        loader.style.display = 'block';
        btnText.textContent = 'Generating...';
    } else {
        generateBtn.disabled = false;
        loader.style.display = 'none';
        btnText.textContent = 'Generate Metadata';
    }
}

function parseAndDisplay(content) {
    // Basic parsing for "Title: ..." and "Keywords: ..."
    const titleMatch = content.match(/Title:\s*(.*)/i);
    const keywordsMatch = content.match(/Keywords:\s*(.*)/is);

    if (titleMatch) {
        titleText.textContent = titleMatch[1].trim();
    } else {
        titleText.textContent = "Could not parse title. See raw response.";
    }

    if (keywordsMatch) {
        keywordsText.textContent = keywordsMatch[1].trim();
    } else {
        keywordsText.textContent = "Could not parse keywords. See raw response.";
    }
}

function copyText(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.borderColor = 'var(--accent-secondary)';
        btn.style.color = 'var(--accent-secondary)';
        
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.borderColor = 'var(--glass-border)';
            btn.style.color = 'var(--text-muted)';
        }, 2000);
    });
}
