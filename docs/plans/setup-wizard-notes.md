@docs/version-v0.3.md I am looking at the task of creating the setup wizard for the second-run of the product. With all the work done on the settings screen to create the individual cards to enable the creation/configuration of providers/models/workspaces and the ability to view their state it feels like we could re-use those components in a single-task focused workflow that an operator would be guided through.

However, I think there are more features that need to be developed to create a setup experience to help the user.

1. Providers

Providers can have their api keys set and we can verify that they have models available. Operators can filter to the free-tier of models but not all of the free-tier models are potentially available. It feels like that a setup procedure to be more comprehensive would need to:

- allow operator to enter api key
- response from broker provides proof that it was set; actions taken if otherwise
- request for the model catalog
- response provides a list of available models; absence of models would provide some message about the broker, provider, or api key needing to be addressed
- the catalog of models does not mean they are all available so each individual one would need to be tested with a small ping or operation sent to them. An error response would remove the model from the list of available models. If all the models returned error then the user would need to address this with the provider or their api key

2. workspaces

Currently setting up a workspace has lots of configuration currently not in a location that can be modiied. Specifically the embedding model. The embedding model as the product is defined now is hard-coded to use the ollama embedding model. But it does not ask the operator to install it or prompt the operator that they should have it. it does not give the operator the ability to set it.

After the operator has set the embedding model and defined a workspace. It would be useful to provide a utility for the operator to use the indexed files with e query to prove that the workspace has been indexed (or started to index).

this feels like a useful interaction like the current chat interaction that is main /ui/chat page experience. Creating a semeantic search panel that enables the user to select a workspace and then enter in search criteria and have it return snippets from those files. This utility could e presented as another button in the left-side ribbon.

In the setup-wizard this interface would set itself to the currently created workspace and then let the user prove that the workspace has already started the indexing process.

3. Virtual Models

The current one default virtual model chimera that gets created could likely be made by default for the user given that they have already done the work with the providers. We could make assumptions that that the user wants to use any available models. About the only change would be to allow the operator to specify the name of the virtual model before it is saved.

The proof that this is working would be to use the chat panel and have a pregenerated chat that starts to check that it is working correctly.

## Challenges

So there are some new features and interactions that feel required for the setup wizard approach feel more bullet-proof. Some of those would be useful features that could be merged into the existing system.

Each of these components would need to be able to execute and handle the error messages and hopefully provide meaningful information when they error.

There is a lot of addition text that needs to be written for each page of the setup. The guided process through this would need to provide systems to help the user through the process.

There are lots of configuration currently only managed in the yaml files on disk that are not currently configurable through any component in the visualized system.