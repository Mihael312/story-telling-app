import React, { useState } from 'react';

const RadioFormComponent = () => {
  const [selectedOption, setSelectedOption] = useState('Energy Control');
  const [inputValue, setInputValue] = useState(
    `YourSecret Invisible Force You Aren't Taking Advantage Of (Energy =Magic)-NOBSguide`
  );
  const [wordCount, setWordCount] = useState('');
  const [detailedResponses, setDetailedResponses] = useState([]); // State for detailed responses


  const handleGenerate = async () => {
    const sectionsCount = Math.ceil(wordCount / 1000); // Determine sections count based on word count
    if (!selectedOption || !inputValue || !wordCount) {
      alert('Please select an option, enter a value, and specify the word count.');
      return;
    }

    try {
      // First fetch to get section titles
      const initialResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAIKey}`,
          "Content-type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: `You need to generate ${sectionsCount} sections about ${selectedOption} with the summary provided by the user. Write only section titles, nothing else.`,
            },
            { role: "user", content: inputValue },
          ],
          max_tokens: 600,
        }),
      });

      const initialData = await initialResponse.json();
      const titles = initialData.choices[0].message.content.split('\n').filter(Boolean); // Split titles into an array

      console.log('Titles returned:', titles);

      // Send a fetch for each title to get detailed content
      const detailedResponsesData = await Promise.all(
        titles.map(async (title) => {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openAIKey}`,
              "Content-type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: [
                {
                  role: "system",
                  content: `Generate detailed content for the section titled "${title}" related to ${selectedOption}.`,
                },
                { role: "user", content: inputValue },
              ],
              max_tokens: 1000, // Adjust token limit for detailed content
            }),
          });
          const data = await response.json();
          return data.choices[0].message.content; // Return detailed content for this title
        })
      );

      console.log('Detailed Responses:', detailedResponsesData);
      setDetailedResponses(detailedResponsesData); // Update state to display detailed responses
    } catch (error) {
      console.error('Error during fetch:', error);
    }
  };

  return (
    <>
      <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Choose an Option</h2>

        <div className="space-y-3 mb-6">
          {['Option 1', 'Option 2', 'Option 3', 'Option 4', 'Option 5'].map((option, index) => (
            <label key={index} className="flex items-center space-x-3 cursor-pointer">
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
          <label htmlFor="inputField" className="block text-sm font-medium text-gray-700 mb-2">
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
          <label htmlFor="wordCount" className="block text-sm font-medium text-gray-700 mb-2">
            Desired Word Count:
          </label>
          <input
            type="number"
            id="wordCount"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700"
            value={wordCount}
            onChange={(e) => setWordCount(e.target.value)}
            placeholder="1000"
          />
        </div>

        <button
          onClick={handleGenerate}
          className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          Generate
        </button>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-800">Generated Detailed Responses:</h3>
        <div className="space-y-4 mt-4">
          {detailedResponses.map((response, index) => (
            <div key={index} className="p-4 bg-gray-100 rounded-lg shadow-md">
              <h4 className="text-md font-bold text-gray-700">Section {index + 1}</h4>
              <p className="text-gray-800">{response}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default RadioFormComponent;
