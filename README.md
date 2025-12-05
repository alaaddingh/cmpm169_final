

Use Instructions:

 1) use the following shell command  to get started:
  "git pull (repo http url)"
  then navigate to project root folder to get started:
  "cd (folder name)"


2) install dependencies: 
    pip install pytorch
    pip install fastapi
    pip install pydantic

3) Run backend:
    (in root folder)
    uvicorn backend.app:app --reload --port 8000

4) Run frontend:
    right click on index.html, run in localhost browser.

5) If nothing happens in browser, try refreshing. Sometimes, the frontend and backend do not sync at first.




Post-mortem:

 I did not get as far as I wanted in this project, I planned to allow
  traps to be placed on lilipads by the user to further complicate the path for the frog, 
  as well as generally more player interaction. I also did not get to make a fully working web build as I 
  could not figure out how to deploy my backend within a remote server. This program works when ran locally.
  I am happy I was able to get a semblance of a working Neural-Network, as with enough iterations, it is able to
  efficiently locate the bug given any seeded map.


Artistic Statement:
    I enjoy watching things unfold in an iterative process. I was inspired by those Youtube Videos in which a person trains a Neural Network to 
    get progressively better at a simple arcade game, such as the "Offline Dino Game" or "Snake". Watching this frog zip around my map has been 
    very fun to witness and tweak.


Credits:
    FastAPI doc: https://fastapi.tiangolo.com/#alternative-api-docs
    
    Pytorch doc on optim.Adam: https://docs.pytorch.org/docs/stable/generated/torch.optim.Adam.html
    
    Joe Iddon's Github Page on Perlin Noise: https://joeiddon.github.io/projects/javascript/perlin.html
    
    GPT for assistance in softmax use for probability distribution:  https://chatgpt.com/share/69323c93-9dac-8002-b274-be8255b4e4c7



