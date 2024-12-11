import React, { useState } from "react";
import { prompts } from "./prompts";
import { Document, Packer, Paragraph, TextRun } from "docx"; // Import docx library

const RadioFormComponent = () => {
  const [selectedOption, setSelectedOption] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [wordCount, setWordCount] = useState("");
  const [detailedResponses, setDetailedResponses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBot, setSelectedBot] = useState("chatgpt");

  const openAIKey = import.meta.env.VITE_OPENAI_KEY;
  const anthropicKey = import.meta.env.VITE_CLAUDE_KEY;

  // Option mapping for both display and storage
  const optionMap = {
    EnergyControl: "Energy Control",
    TheTruthAboutLifeDeathAndTheAfterlife: "The truth about life, death & the afterlife",
    ConspiracyControllingReality: "Conspiracy Controlling Reality",
    EscapingSimulation: "Escaping Simulation",
    TimeLoopsAndAlternateRealities: "Time Loops, Alternate Realities",
  };

  // Function to pause for a given time (in milliseconds)
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleGenerate = async () => {
    if (!selectedOption || !inputValue || !wordCount) {
      alert("Please select an option, enter a value, and specify the word count.");
      return;
    }

    setLoading(true);
    setDetailedResponses([]);

    try {
      const selectedOptionText = selectedOption;
      const selectedPrompt = prompts[selectedOptionText];

      if (!selectedPrompt) {
        alert("No prompt found for the selected option.");
        setLoading(false);
        return;
      }

      const sectionsCount = wordCount > 1000 ? Math.ceil(wordCount / 1000) : 1;

      const callAPI = async (messages, maxTokens = 600) => {
        const endpoint =
          selectedBot === "chatgpt"
            ? "https://api.openai.com/v1/chat/completions"
            : "https://api.anthropic.com/v1/messages";

        const headers =
          selectedBot === "chatgpt"
            ? {
                Authorization: `Bearer ${openAIKey}`,
                "Content-type": "application/json",
              }
            : {
                "X-API-Key": anthropicKey,
                "Content-type": "application/json",
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true",
              };

        const body =
          selectedBot === "chatgpt"
            ? {
                model: "gpt-4",
                messages,
                max_tokens: maxTokens,
                temperature: 0.5,
              }
            : {
                model: "claude-3-5-sonnet-20241022",
                system: messages[0].content,
                messages: [messages[1]],
                max_tokens: maxTokens,
                temperature: 0.5,
              };

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });

        return response.json();
      };

      const initialMessages = [
        {
          role: "system",
          content: `Generate ${sectionsCount} section titles, tones, and formats {title: string, tone: string, format: string} related to "${selectedOptionText}" based on the following summary. Ensure each section follows a logical, chronological order. Data Points Separator: Use %%% to split data points. ${selectedPrompt} Do not generate anything else; failure to comply will result in penalties.`,
        },
        { role: "user", content: inputValue },
      ];

      const initialResponse = await callAPI(initialMessages, 600);
      const titles =
        selectedBot === "chatgpt"
          ? initialResponse.choices[0].message.content.split("%%%").filter(Boolean)
          : initialResponse.content[0].text.split("%%%").filter(Boolean);

      const batchSize = 5;
      let batchIndex = 0;

      while (batchIndex * batchSize < titles.length) {
        const batch = titles.slice(batchIndex * batchSize, batchIndex * batchSize + batchSize);

        const batchPromises = batch.map(async (title) => {
          const contentMessages = [
            {
              role: "system",
              content: `Provide detailed content min 1000 words for the section with title and tone: ${title} related to ${selectedOptionText}, ensuring it's well-structured and easy to read.`,
            },
            { role: "user", content: inputValue },
          ];

          try {
            const contentResponse = await callAPI(contentMessages, 1000);
            const content =
              selectedBot === "chatgpt"
                ? contentResponse.choices[0].message.content
                : contentResponse.content[0].text;

            return { title, content };
          } catch (error) {
            console.error(`Error fetching content for title: ${title}`, error);
            return { title, content: "Error fetching content" };
          }
        });

        const results = await Promise.all(batchPromises);
        setDetailedResponses((prev) => [...prev, ...results]);

        batchIndex++;

        if (batchIndex * batchSize < titles.length) {
          await sleep(60000);
        }
      }
    } catch (error) {
      console.error("Error during fetch:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: detailedResponses.map((response) => {
            // Convert the response content into docx components (Paragraphs, TextRun)
            const paragraphs = response.content.split("\n").map((line) => {
              let formattedLine = line;
  
              // Handling bold tags <b>...</b>
              formattedLine = formattedLine.replace(/<b>(.*?)<\/b>/g, (match, p1) => {
                return `<strong>${p1}</strong>`;
              });
  
              // Handling italic tags <i>...</i>
              formattedLine = formattedLine.replace(/<i>(.*?)<\/i>/g, (match, p1) => {
                return `<em>${p1}</em>`;
              });
  
              // For now, assume that everything is plain text
              const textRun = new TextRun(formattedLine);
              return new Paragraph({
                children: [textRun],
              });
            });
  
            return paragraphs; // Return the paragraphs created from the formatted lines
          }).flat(), // Flatten the nested array of paragraphs
        },
      ],
    });
  
    // Use Packer to convert to Blob and trigger download
    Packer.toBlob(doc).then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
  
      let filename =
        selectedOption
          .trim() // Remove leading/trailing spaces
          .toLowerCase() // Convert to lowercase
          .replace(/[^a-z0-9]/g, "_") // Replace non-alphanumeric chars with underscore
          .replace(/_+/g, "_") // Replace multiple underscores with single
          .replace(/^_|_$/g, "") || // Remove leading/trailing underscores
        "generated_content";
  
      link.href = url;
      link.download = `${filename}.docx`; // Use the processed filename
      link.click();
  
      window.URL.revokeObjectURL(url);
    });
  };
  
  

  return (
    <>
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select AI Model:
          </label>
          <select
            value={selectedBot}
            onChange={(e) => setSelectedBot(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
          >
            <option value="chatgpt">ChatGPT</option>
            <option value="claude">Claude</option>
          </select>
        </div>

        <h2 className="text-xl font-bold mb-4 text-gray-800">Choose an Option</h2>

        <div className="space-y-3 mb-6">
          {Object.entries(optionMap).map(([key, value]) => (
            <label key={key} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="options"
                value={key}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                checked={selectedOption === key}
                onChange={(e) => setSelectedOption(e.target.value)}
              />
              <span className="text-gray-700">{value}</span>
            </label>
          ))}
        </div>

        <div className="mb-6">
          <label
            htmlFor="inputField"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Enter a value:
          </label>
          <input
            type="text"
            id="inputField"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter something here"
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="wordCount"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Desired Word Count:
          </label>
          <input
            type="number"
            id="wordCount"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
            value={wordCount}
            onChange={(e) => setWordCount(e.target.value)}
            placeholder="1000"
            min={1000}
            max={50000}
            step={1000}
          />
        </div>

        <button
          onClick={handleGenerate}
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          Generate
        </button>
      </div>

      {loading && (
        <div className="flex justify-center mt-6 flex-col items-center">
          <p className="mb-4 text-gray-700">This may take a few minutes...</p>
          <div
            className="spinner-border animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
            role="status"
          >
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      )}

      {!loading && detailedResponses.length > 0 && (
        <div className="mt-6">
          <button
            onClick={handleDownload}
            className="w-full px-4 py-2 text-white bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
          >
            Download Word Document
          </button>
        </div>
      )}

      <div className="mt-6 mx-3">
        <h3 className="text-lg font-semibold text-gray-800">Generated Detailed Responses:</h3>
        <div className="space-y-4 mt-4">
          {detailedResponses.map((response, index) => (
            <div key={index} className="p-4 bg-gray-100 rounded-lg shadow-md">
              <h4 className="text-md font-bold text-gray-700">{response.title}</h4>
              <div dangerouslySetInnerHTML={{ __html: response.content }} />
            </div>
          ))}
        </div>
      </div>

      
    </>
  );
};

export default RadioFormComponent;
