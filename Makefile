.PHONY: run-server
run-server: 
	cd server && flask run

.PHONY: run-client
run-client:
	cd client && npm run dev
