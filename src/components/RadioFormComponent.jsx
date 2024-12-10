import React, { useState } from "react";

const RadioFormComponent = () => {
  const [selectedOption, setSelectedOption] = useState("");
  const [inputValue, setInputValue] = useState(
    "YourSecret Invisible Force You Aren't Taking Advantage Of (Energy=Magic)-NOBSguide"
  );
  const [wordCount, setWordCount] = useState("");
  const [detailedResponses, setDetailedResponses] = useState([]); // State for detailed responses
  const [loading, setLoading] = useState(false); // State for loading
  const openAIKey = import.meta.env.VITE_OPENAI_KEY;

  // Function to pause for a given time (in milliseconds)
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleGenerate = async () => {
    if (!selectedOption || !inputValue || !wordCount) {
      alert(
        "Please select an option, enter a value, and specify the word count."
      );
      return;
    }

    setLoading(true); // Set loading to true
    setDetailedResponses([]); // Clear previous responses

    try {
      // Dynamically determine the number of sections based on word count
      const sectionsCount = wordCount > 1000 ? Math.ceil(wordCount / 1000) : 1;

      // First fetch to get section titles
      const initialResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAIKey}`,
            "Content-type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: `Generate ${sectionsCount} section titles, tones, and formats {title: string, tone: string, format: string} related to "${selectedOption}" based on the following summary. Ensure each section follows a logical, chronological order.

Data Points Separator: Use %%% to split data points.

TONE

Encouraging, empowering, uplifting, warm, and friendly.
Balance mysticism and practicality by using metaphors (e.g., rivers, threads, cocoons) to simplify complex spiritual concepts.
Incorporate science alongside ancient wisdom.

FORMAT:
Hook: Present a universal human experience.
Re-Hook: Pose questions like "What if…?" or "Have you considered…?"
Introduction: Establish the importance of understanding one’s energy field, setting the stakes for transformation.
Contents:
Detailed explanations of the aura layers and chakras.
Problem identification (e.g., energy blockages).
Practical tools (e.g., pranayama, meditation, mindfulness) with step-by-step guidance.
CTA (Call to Action): Encourage actions such as trying a technique, incorporating exercises, or taking steps toward goals with a positive mindset

Do not generate anything else; failure to comply will result in penalties.`,
                                        },
              { role: "user", content: inputValue },
            ],
            max_tokens: 600,
            temperature: 0.3,
          }),
        }
      );

      const initialData = await initialResponse.json();
      const titles = initialData.choices[0].message.content
        .split("%%%")
        .filter(Boolean); // Split titles into an array

      console.log("Titles returned:", titles);

      for (let i = 0; i < titles.length; i++) {
        const title = titles[i];
        try {
          const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${openAIKey}`,
                "Content-type": "application/json",
              },
              body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                  {
                    role: "system",
                    content: `Provide detailed content min 1000 words for the section with title and tone: ${title} related to ${selectedOption}, ensuring it's well-structured and easy to read. Follow these formatting guidelines:
                              Do not include the title in the response, only the content.
                              Use appropriate headings (H1, H2, H3) for different sections, ensuring each section has a clear heading.
                              Break the content into paragraphs for readability.
                              Highlight important terms and concepts using bold text.
                              Use lists (bulleted or numbered) where applicable for clarity.
                              Ensure the response has clarity and flow, with smooth transitions between ideas.
                              Maintain a professional, informative, and engaging tone.
                              The goal is a readable, well-formatted response that's easy to follow and absorb.`,
                  },
                  { role: "user", content: inputValue },
                ],
                max_tokens: 1000,
                temperature: 0.5,
              }),
            }
          );

          const data = await response.json();
          const formattedContent = formatContent(
            data.choices[0].message.content
          );

          // Add the new response to the state
          setDetailedResponses((prev) => [
            ...prev,
            { title, content: formattedContent },
          ]);

          console.log(`Fetched content for title: ${title}`);
        } catch (error) {
          console.error(`Error fetching content for title: ${title}`, error);

          // Add an error message for the failed request
          setDetailedResponses((prev) => [
            ...prev,
            { title, content: "Error fetching content" },
          ]);
        }

        // Add a delay of 3 seconds between requests
        if (i < titles.length - 1) {
          console.log("Pausing for 3 seconds...");
          await sleep(3000);
        }
      }
    } catch (error) {
      console.error("Error during fetch:", error);
    } finally {
      setLoading(false); // Set loading to false when the process is finished
    }
  };

  const formatContent = (content) => {
    content = content.trim(); // Remove extra leading/trailing whitespace

    // Format headers ensuring they aren't duplicated
    content = content.replace(
      /^#### (.*?)$/gm,
      '<h4 class="text-sm font-semibold">$1</h4>'
    ); // For h4
    content = content.replace(
      /^### (.*?)$/gm,
      '<h3 class="text-md font-medium">$1</h3>'
    ); // For h3
    content = content.replace(
      /^## (.*?)$/gm,
      '<h2 class="text-lg font-semibold">$1</h2>'
    ); // For h2
    content = content.replace(
      /^# (.*?)$/gm,
      '<h1 class="text-xl font-bold">$1</h1>'
    ); // For h1

    // Format bold and italic text
    content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"); // bold
    content = content.replace(/\*(.*?)\*/g, "<em>$1</em>"); // italic

    // Format unordered lists
    content = content.replace(
      /^\s*-\s+(.*)$/gm,
      '<li class="list-disc pl-5">$1</li>'
    ); // List items

    // Wrap list items in a <ul> tag
    content = content.replace(
      /(<li.*<\/li>)/g,
      '<ul class="list-disc pl-5">$1</ul>'
    ); // Wrap <li> elements with <ul>

    // Clean up newlines and non-content lines, wrapping paragraphs in <p> tags
    content = content
      .split("\n")
      .filter((line) => line.trim() !== "") // Remove empty lines
      .map((line) => {
        // Check if line is a list item or header to avoid wrapping it in <p>
        if (line.startsWith("<li>") || line.startsWith("<h")) {
          return line; // Don't wrap list or header in <p>
        } else {
          return `<p class="text-gray-800">${line}</p>`; // Wrap regular text in <p>
        }
      })
      .join("\n");

    return content;
  };

  return (
    <>
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          Choose an Option
        </h2>

        <div className="space-y-3 mb-6">
          {[
            "Energy Control",
            "The truth about life, death & the afterlife",
            "ConspiracyControllingReality",
            "Escaping Simulation",
            "Time Loops, Alternate Realities",
          ].map((option, index) => (
            <label
              key={index}
              className="flex items-center space-x-3 cursor-pointer"
            >
              <input
                type="radio"
                name="options"
                value={option}
                className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                checked={selectedOption === option}
                onChange={(e) => setSelectedOption(e.target.value)}
              />
              <span className="text-gray-700">{option}</span>
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

        {/* Word count input section */}
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

      {/* Spinner Loading Animation */}
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

      <div className="mt-6 mx-3">
        <h3 className="text-lg font-semibold text-gray-800">
          Generated Detailed Responses:
        </h3>
        <div className="space-y-4 mt-4">
          {detailedResponses.map((response, index) => (
            <div key={index} className="p-4 bg-gray-100 rounded-lg shadow-md">
              <h4 className="text-md font-bold text-gray-700">
                {response.title}
              </h4>
              <br/>
              <br/>
              <div dangerouslySetInnerHTML={{ __html: response.content }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default RadioFormComponent;
