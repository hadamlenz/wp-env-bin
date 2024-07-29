function logger(output,log=true) {
    if(log){
        console.log(output);
    } else {
        return output;
    }
}

module.exports = { logger }