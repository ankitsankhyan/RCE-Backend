const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs").promises;  // Use the promisified version of fs
const { exec } = require("child_process");
const cors = require('cors');

const app = express();
app.use(bodyParser.json());

const port = process.env.PORT || 3010;
const corsOptions = {
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const languagesCompiler = {
    "c++": "g++",
    "java": "javac",
    "python": "python",
    "javascript": "node",
};

const fileExtensions = {
    "c++": "cpp",
    "java": "java",
    "python": "py",
    "javascript": "js",
};

const getExecutionCommand = (language, filename, input) => {
    const compiler = languagesCompiler[language];

    switch (language) {
        case "c++":
            return `./a.out < input.txt > output.txt`;
        case "java":
            return `java ${filename.replace(".java", "")} < input.txt > output.txt`;
        case "python":
            return `python ${filename} < input.txt > output.txt`;
        case "javascript":
            return `node ${filename} < input.txt > output.txt`;
        default:
            return ""; // Handle unsupported languages
    }
};

const writeFileAsync = async (filename, value) => {
    try {
        await fs.writeFile(filename, value);
        console.log("File written successfully\n");
        console.log(value);
    } catch (error) {
        throw new Error("Could not write file");
    }
};

const executeCodeAsync = async (command, filename) => {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            // Remove the temporary file
            fs.unlink(filename)
                .then(() => {
                    if (error) {
                        console.error(`Error executing command: ${command}`);
                        console.error(error);
                        reject(new Error("Could not run code"));
                    } else if (stderr) {
                        reject(new Error(stderr));
                    } else {
                        //add the stdout in the output.txt file
                        console.log("output.txt file created");
                        console.log(stdout);

                        resolve(stdout);
                    }
                })
                .catch((unlinkError) => {
                    console.error(`Error deleting file: ${filename}`);
                    console.error(unlinkError);
                    reject(new Error("Could not delete file"));
                });
        });
    });
};

app.post("/api/code", async (req, res) => {
    const { value, language, input } = req.body;

    // Error handling
    if (!language || !value) {
        return res.status(400).json({ error: "Language and code are required fields" });
    }

    if (!languagesCompiler[language]) {
        return res.status(400).json({ error: "Unsupported language" });
    }

    // Create a unique filename with the appropriate extension
    const filename = `code_${Date.now()}.${fileExtensions[language]}`;
    //create a input.txt file
    const inputfile = `input.txt`;
    //create a output.txt file
    const outputfile = `output.txt`;

    try {
        await writeFileAsync(filename, value);
        //write the input in input.txt file
        await writeFileAsync(inputfile, input);

        // Execute the code
        const executionCommand = getExecutionCommand(language, filename, input);
        const output = await executeCodeAsync(executionCommand, filename);

        // Read the output file
        const outputFileContent = await fs.readFile(outputfile, "utf-8");
        res.json({ output: outputFileContent });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: error.message });
    }
});

// Additional Endpoint: Fetch content of input.txt
app.get("/api/input", async (req, res) => {
    try {
        const content = await fs.readFile("input.txt", "utf-8");
        res.json({ content });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Could not read input.txt" });
    }
});

// Additional Endpoint: Fetch content of output.txt
app.get("/api/output", async (req, res) => {
    try {
        const content = await fs.readFile("output.txt", "utf-8");
        res.json({ content });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Could not read output.txt" });
    }
});
