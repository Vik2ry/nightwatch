Feature: Google Search
Background: Background name
  Given I open Google page
  Then the title is "Google"
@a @b
Scenario: Searching Google
  Given I search nightwatchjs
  Then Body contains nightwatchjs

