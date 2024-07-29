//make a config file for making the wp-env
const configTemplate = (options) => {
	console.log("> Making config");
	var config = {
		config: {
			...options
		},
	};
	return JSON.stringify(config, null, " ");
};

module.exports = configTemplate;
