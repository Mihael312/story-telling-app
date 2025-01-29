import React, { useState } from "react";
import { prompts } from "./prompts";
import { Document, Packer, Paragraph, TextRun } from "docx";
import Markdown from 'react-markdown';

const RadioFormComponent = () => {
  const [selectedOption, setSelectedOption] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [additionalData, setAdditionalData] = useState("");
  const [excludedWords, setExcludedWords] = useState("");
  const [desiredWordCount, setDesiredWordCount] = useState("");
  const [generatedSections, setGeneratedSections] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedModel, setSelectedModel] = useState("o1-preview");

  const openAIKey = import.meta.env.VITE_OPENAI_KEY;
  const anthropicKey = import.meta.env.VITE_ANTHROPIC_KEY;

  // Option mapping for both display and storage
  const optionMap = {
    EnergyControl: "Energy Control",
    TheTruthAboutLifeDeathAndTheAfterlife: "The truth about life, death & the afterlife",
    ConspiracyControllingReality: "Conspiracy Controlling Reality",
    EscapingSimulation: "Escaping Simulation",
    TimeLoopsAndAlternateRealities: "Time Loops, Alternate Realities",
  };

  // Sleep function
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const callAPI = async (messages, maxTokens) => {
    const isAnthropic = selectedModel.includes("claude");

    const endpoint = isAnthropic
      ? "https://api.anthropic.com/v1/messages"
      : "https://api.openai.com/v1/chat/completions";

    const headers = isAnthropic
      ? {
          "x-api-key": anthropicKey,
          "Content-type": "application/json",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        }
      : {
          Authorization: `Bearer ${openAIKey}`,
          "Content-type": "application/json",
        };

    let modelName = selectedModel;
    if (selectedModel.includes("claude")) {
      modelName = "claude-3-5-sonnet-20241022";
    }

    let body;
    if (isAnthropic) {
      // Anthropic format
      body = {
        model: modelName,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
      };
    } else {
      // OpenAI format
      body = {
        model: modelName,
        messages,
      };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return response.json();
  };

  const handleGenerateScript = async () => {
    if (!selectedOption || !scriptTitle || !desiredWordCount) {
      alert("Please select an option, enter a title, and specify the word count.");
      return;
    }

    setLoading(true);
    setGeneratedSections([]);

    try {
      const selectedPrompt = prompts[selectedOption];
      if (!selectedPrompt) {
        alert("No prompt found for the selected option.");
        setLoading(false);
        return;
      }

      let sectionsCount;
      // Original formula for o1-preview
      if (selectedModel === "o1-preview") {
        sectionsCount = desiredWordCount > 1000 ? Math.ceil(desiredWordCount / 1000) : 1;
      } else {
        // New formula for claude 3.5 sonnet and gpt-4o
        // For example, 10000 words -> about 13 sections
        // 10000 / 770 ≈ 12.99, round up to 13
        sectionsCount = desiredWordCount > 1000 ? Math.ceil(desiredWordCount / 1000) : 1;
      }

      const initialMessages = [
        {
          role: "user",
          content: `You are a YouTube video script writer and you have to generate ONLY a JSON array of ${sectionsCount} objects:
  
          Each object should have the following structure:
          {
            "title": "Section title",
            "tone": "Tone of the section",
            "format": "A concise description or example of how the section should be structured",
            "data": "Relevant data to be discussed in this section ("" if none)"
          } 

          The script domain is ${selectedOption} and the script title is ${scriptTitle}

          *Ensure each section follows a logical, chronological order.* 

          ***TONE AND FORMAT:*** 
          ${selectedPrompt}

          ***ADDITIONAL INFO/DATA:*** 
          ${additionalData}`
        }
      ];

      // Fetch the section titles
      const initialResponse = await callAPI(initialMessages, 2000);

      let titles;
      if (selectedModel.includes("claude")) {
        titles = JSON.parse(
          initialResponse.content[0].text
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim()
        );
      } else {
        titles = JSON.parse(
          initialResponse.choices[0].message.content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim()
        );
      }

      console.log("Section Titles:", titles);

      const batchSize = 5;
      let batchIndex = 0;

      while (batchIndex * batchSize < titles.length) {
        const batch = titles.slice(batchIndex * batchSize, batchIndex * batchSize + batchSize);

        const batchPromises = batch.map(async (titleObj, index) => {
          const currentIndex = batchIndex * batchSize + index;
          const prevSection = currentIndex > 0 ? titles[currentIndex - 1].title : "There is no Previous section";
          const nextSection = currentIndex < titles.length - 1 ? titles[currentIndex + 1].title : "There is no Next section";

          const contentMessages = [
            {
              role: "user",
              content: `
              You are a YouTube video script writer and must write a detailed story/script text (~1000 words) for the following section. 
              - Do not include scene directions or narrator markers, only the spoken text.
              - Keep the language simple, avoiding mystical or overly complex words.
              - Don't use the welcoming phrases at the beginning of the sections
              - Ensure coherence and flow from the previous section to this one.
              - If possible, exclude these words: ${excludedWords}

              Title: ${titleObj.title}
              Domain: ${selectedOption}

              Current Section: ${titleObj.title}
              Previous Section: ${prevSection}
              Next Section: ${nextSection}`
            }
          ];

          try {
            const contentResponse = await callAPI(contentMessages, 2000);
            const content = selectedModel.includes("claude")
              ? contentResponse.content[0].text
              : contentResponse.choices[0].message.content;

            return { title: titleObj, content };
          } catch (error) {
            console.error(`Error fetching content for title: ${titleObj.title}`, error);
            return { title: titleObj, content: "Error fetching content" };
          }
        });

        const results = await Promise.all(batchPromises);
        setGeneratedSections((prev) => [...prev, ...results]);

        batchIndex++;

        // If there are more sections to generate, wait for a minute (to avoid rate limits)
        if (batchIndex * batchSize < titles.length) {
          await sleep(60000);
        }
      }

    } catch (error) {
      console.error("Error during script generation:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDoc = () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: generatedSections
            .map((section) => {
              const paragraphs = section.content.split("\n").map((line) => {
                let formattedLine = line;

                // Replace <b> and <i> tags
                formattedLine = formattedLine.replace(/<b>(.*?)<\/b>/g, "**$1**");
                formattedLine = formattedLine.replace(/<i>(.*?)<\/i>/g, "_$1_");

                const textRun = new TextRun(formattedLine);
                return new Paragraph({
                  children: [textRun],
                });
              });
              return paragraphs;
            })
            .flat(),
        },
      ],
    });

    Packer.toBlob(doc).then((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      let filename =
        selectedOption
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "") || "generated_content";

      link.href = url;
      link.download = `${filename}.docx`;
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
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
          >
            <option value="o1-preview">o1-preview</option>
            <option value="claude 3.5 sonnet">claude 3.5 sonnet</option>
            <option value="gpt-4o">gpt-4o</option>
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
            htmlFor="scriptTitle"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Enter the title of the script:
          </label>
          <input
            type="text"
            id="scriptTitle"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
            value={scriptTitle}
            onChange={(e) => setScriptTitle(e.target.value)}
            placeholder="Enter the script title"
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="additionalData"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Enter additional data (summary, narrative, etc.):
          </label>
          <textarea
  id="additionalData"
  className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
  style={{ height: "200px", resize: "vertical", whiteSpace: "pre-wrap" }}
  value={additionalData}
  onChange={(e) => setAdditionalData(e.target.value)}
  placeholder="Enter additional data"
/>

        </div>

        <div className="mb-6">
          <label
            htmlFor="excludedWords"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Words to exclude (not guaranteed):
          </label>
          <input
            type="text"
            id="excludedWords"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
            value={excludedWords}
            onChange={(e) => setExcludedWords(e.target.value)}
            placeholder="Enter forbidden words"
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="desiredWordCount"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Desired Word Count:
          </label>
          <input
            type="number"
            id="desiredWordCount"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
            value={desiredWordCount}
            onChange={(e) => setDesiredWordCount(e.target.value)}
            placeholder="1000"
            min={1000}
            max={50000}
            step={1000}
          />
        </div>

        <button
          onClick={handleGenerateScript}
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          Generate
        </button>
      </div>

      {loading && (
        <div className="flex justify-center mt-6 flex-col items-center">
          <p className="mb-4 text-gray-700">This may take a few moments...</p>
          <div
            className="spinner-border animate-spin inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
            role="status"
          >
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      )}

      {!loading && generatedSections.length > 0 && (
        <div className="mt-6">
          <button
            onClick={handleDownloadDoc}
            className="w-25 px-4 py-2 text-white ms-5 bg-green-600 rounded-lg shadow-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
          >
            Download Word Document
          </button>
        </div>
      )}

      <div className="mt-6 mx-3">
        <h3 className="text-lg ms-2 font-semibold text-gray-800">Generated Detailed Responses:</h3>
        <div className="space-y-4 mt-4 mx-5 p-5">
          {generatedSections.map((section, index) => (
            <div key={index} className="p-4 bg-gray-100 rounded-lg shadow-md">
              <h3 className="text-md font-bold text-gray-700 mb-5">
                <strong>Section title:</strong> {section.title.title}
              </h3>
              <h4 className="text-md font-bold text-gray-700 mb-5">
                <strong>Section format:</strong> {section.title.format}
              </h4>
              <h4 className="text-md font-bold text-gray-700 mb-5">
                <strong>Section additional data:</strong> {section.title.data === "" ? "None" : section.title.data}
              </h4>

              <Markdown>{section.content}</Markdown>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default RadioFormComponent;
