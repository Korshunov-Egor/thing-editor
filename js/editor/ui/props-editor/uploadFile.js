const upload = (file) => {
	const data = new FormData();
	data.append('file', file);

	window.fetch('/', {
		method: 'POST',
		mode: 'cors',
		body: data
	})
		.then(response => {
			if(response.ok){
				return response;
			} else {
				throw new Error(response.status);
			}
		})
		.then(data => console.log("Fail Uploaded Successfully" + data))
		.catch(error => {
			console.log("Failed to Upload File" + error);
		});
};

export {upload} ;