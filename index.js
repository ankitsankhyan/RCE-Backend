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
    "C++": "g++",
    "java": "javac",
    "python": "python",
    "JS": "node",
};

const fileExtensions = {
    "C++": "cpp",
    "java": "java",
    "python": "py",
    "JS": "js",
};

const getExecutionCommand = (language, filename, inputfile , outputfile) => {
    const compiler = languagesCompiler[language];

    switch (language) {
        case "C++":
            return `${compiler} ${filename} -o ${filename.replace(".cpp","")}
            && ./${filename.replace(".cpp",".exe")} < ${inputfile} > ${outputfile}`;
        case "java":
            return `${compiler} ${filename} -o ${filename.replace(".java","")}
            && ./${filename.replace(".java","")} < input.txt > output.txt`;
        case "python":
            return `python ${filename} < input.txt > output.txt`;
        case "JS":
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

const executeCodeAsync = async (command, filename, inputfile="input.txt", outputfile="output.txt", timeout = 5000, maxOutputLength = 1024) => {
    return new Promise((resolve, reject) => {
        const process = exec(command, async (error, stdout, stderr) => {
            clearTimeout(timeoutId); // Clear the timeout if the process completes before the timeout
            console.log(stdout, 'is stdout');
            try {
                console.log(filename, 'is filename');
                await fs.unlink(filename);
                await fs.unlink(inputfile);
            } catch (unlinkError) {
                console.error(`Error deleting files: ${filename}, ${inputfile}`);
                console.error(unlinkError);
                reject(new Error("Could not delete files"));
                return;
            }

            if (error) {
                console.error(`Error executing command: ${command}`);
                console.error(error);
                reject(new Error(error.message));
            } else if (stderr) {
                reject(new Error(stderr));
            } else {
               

                // Limit output length
                // console.log(stdout, 'is stdout ++++++++++++++++++++++++++++++++++++++++++++++++++++++')
                const limitedOutput = stdout.substring(0, maxOutputLength);
                console.log(limitedOutput);
                resolve(limitedOutput);
            }
        });

        // Set a timeout for the execution
        const timeoutId = setTimeout(() => {
            process.kill("SIGKILL"); // Terminate the process
            reject(new Error("Code execution timed out"));
        }, timeout);
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
    var filename = `code_${Date.now()}.${fileExtensions[language]}`;
    //create a input.txt file
    const inputfile = `input.txt`;
    //create a output.txt file
    const outputfile = `output.txt`;

    try {
        await writeFileAsync(filename, value);
        //write the input in input.txt file
        await writeFileAsync(inputfile, input);
         
        // Execute the code
       
        const executionCommand = getExecutionCommand(language, filename, inputfile, outputfile );
        console.log(executionCommand, 'is execution command')
      await executeCodeAsync(executionCommand, filename);
   
        // Read the output file
        if(language == 'C++'){
            filename = filename.replace(".cpp",".exe");
            const currentDirectory = process.cwd();
           
            var command = `${filename}  > ${outputfile}`;
            await writeFileAsync(inputfile, input);
           
            await executeCodeAsync(command, filename);
           
        }
        const outputFileContent = await fs.readFile(outputfile, "utf-8");
        // clear output
        fs.truncate(outputfile, 0, function(){console.log('done')} );
     
      
        // fs.unlink(filename);
        res.json({ output: outputFileContent });
    } catch (error) {
        console.log(error.message, 'is error');
        res.status(500).json({ error: error.message });
    }
});


